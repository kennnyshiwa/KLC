import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const SYNC_INTERVAL = 60; // Sync every 60 seconds

const formatTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatTimeVerbose = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
};

const PlayTimeCounter: React.FC = () => {
  const { user } = useAuth();
  const [serverTime, setServerTime] = useState<number>(0);
  const [sessionTime, setSessionTime] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(!document.hidden);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const lastSyncTime = useRef<number>(0);
  const timerRef = useRef<number | undefined>(undefined);
  const sessionTimeRef = useRef<number>(0);

  // Keep sessionTimeRef in sync with sessionTime state
  useEffect(() => {
    sessionTimeRef.current = sessionTime;
  }, [sessionTime]);

  // Total time is server time + current session time
  const totalTime = serverTime + sessionTime;

  // Fetch initial play time from server
  const fetchPlayTime = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/playtime`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setServerTime(data.totalPlayTime || 0);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Failed to fetch play time:', error);
    }
  }, [user]);

  // Sync session time to server
  const syncToServer = useCallback(async (seconds: number) => {
    if (!user || seconds <= 0) return;

    try {
      const response = await fetch(`${API_URL}/playtime/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seconds })
      });

      if (response.ok) {
        const data = await response.json();
        setServerTime(data.totalPlayTime);
        setSessionTime(0);
        lastSyncTime.current = 0;
      }
    } catch (error) {
      console.error('Failed to sync play time:', error);
    }
  }, [user]);

  // Sync using sendBeacon for page unload or logout
  // Note: This doesn't check for user because it may be called during logout
  // when user is transitioning to null
  const syncWithBeacon = useCallback((seconds: number) => {
    if (seconds <= 0) return;

    const url = `${API_URL}/playtime/sync`;
    const data = JSON.stringify({ seconds });

    // sendBeacon is more reliable during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    }
  }, []);

  // Listen for logout event and sync before session is destroyed
  useEffect(() => {
    const handleBeforeLogout = () => {
      if (sessionTimeRef.current > 0) {
        syncWithBeacon(sessionTimeRef.current);
      }
    };

    window.addEventListener('app:before-logout', handleBeforeLogout);
    return () => window.removeEventListener('app:before-logout', handleBeforeLogout);
  }, [syncWithBeacon]);

  // Fetch play time on mount when user is logged in
  useEffect(() => {
    if (user) {
      fetchPlayTime();
    } else {
      setServerTime(0);
      setSessionTime(0);
      setIsInitialized(false);
    }
  }, [user, fetchPlayTime]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      setIsVisible(nowVisible);

      if (!nowVisible && sessionTime > 0) {
        // Tab became hidden, sync to server
        syncToServer(sessionTime);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionTime, syncToServer]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionTime > 0) {
        syncWithBeacon(sessionTime);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionTime, syncWithBeacon]);

  // Timer that increments every second when visible
  useEffect(() => {
    if (!user || !isVisible || !isInitialized) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      setSessionTime(prev => {
        const newTime = prev + 1;
        lastSyncTime.current += 1;

        // Sync to server every SYNC_INTERVAL seconds
        if (lastSyncTime.current >= SYNC_INTERVAL) {
          syncToServer(newTime);
        }

        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [user, isVisible, isInitialized, syncToServer]);

  // Don't render if not logged in
  if (!user) {
    return null;
  }

  return (
    <div
      className="playtime-counter"
      title={`Total time spent in KLC: ${formatTimeVerbose(totalTime)}`}
    >
      <Clock size={16} />
      <span className="playtime-counter-number">{formatTime(totalTime)}</span>
    </div>
  );
};

export default PlayTimeCounter;
