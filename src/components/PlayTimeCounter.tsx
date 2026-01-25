import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const SYNC_INTERVAL = 60; // Sync every 60 seconds
const LEADER_KEY = 'klc_playtime_leader';
const LEADER_HEARTBEAT_INTERVAL = 1000; // 1 second
const LEADER_STALE_THRESHOLD = 3000; // 3 seconds - leader is stale if no heartbeat

// Generate a unique tab ID
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

interface LeaderInfo {
  tabId: string;
  timestamp: number;
}

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

const getLeaderInfo = (): LeaderInfo | null => {
  try {
    const data = localStorage.getItem(LEADER_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Invalid data, clear it
    localStorage.removeItem(LEADER_KEY);
  }
  return null;
};

const setLeaderInfo = (tabId: string): void => {
  const info: LeaderInfo = { tabId, timestamp: Date.now() };
  localStorage.setItem(LEADER_KEY, JSON.stringify(info));
};

const isLeaderStale = (info: LeaderInfo | null): boolean => {
  if (!info) return true;
  return Date.now() - info.timestamp > LEADER_STALE_THRESHOLD;
};

const PlayTimeCounter: React.FC = () => {
  const { user } = useAuth();
  const [serverTime, setServerTime] = useState<number>(0);
  const [sessionTime, setSessionTime] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(!document.hidden);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLeader, setIsLeader] = useState<boolean>(false);

  const lastSyncTime = useRef<number>(0);
  const timerRef = useRef<number | undefined>(undefined);
  const leaderCheckRef = useRef<number | undefined>(undefined);
  const sessionTimeRef = useRef<number>(0);

  // Keep sessionTimeRef in sync with sessionTime state
  useEffect(() => {
    sessionTimeRef.current = sessionTime;
  }, [sessionTime]);

  // Total time is server time + current session time
  const totalTime = serverTime + sessionTime;

  // Try to become or maintain leader status
  const tryBecomeLeader = useCallback(() => {
    const currentLeader = getLeaderInfo();

    if (currentLeader?.tabId === TAB_ID) {
      // We are already leader, update heartbeat
      setLeaderInfo(TAB_ID);
      setIsLeader(true);
      return true;
    }

    if (isLeaderStale(currentLeader)) {
      // No leader or stale leader, we become leader
      setLeaderInfo(TAB_ID);
      setIsLeader(true);
      return true;
    }

    // Someone else is leader
    setIsLeader(false);
    return false;
  }, []);

  // Relinquish leadership
  const relinquishLeadership = useCallback(() => {
    const currentLeader = getLeaderInfo();
    if (currentLeader?.tabId === TAB_ID) {
      localStorage.removeItem(LEADER_KEY);
    }
    setIsLeader(false);
  }, []);

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
  const syncWithBeacon = useCallback((seconds: number) => {
    if (seconds <= 0) return;

    const url = `${API_URL}/playtime/sync`;
    const data = JSON.stringify({ seconds });

    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    }
  }, []);

  // Listen for logout event and sync before session is destroyed
  useEffect(() => {
    const handleBeforeLogout = () => {
      if (isLeader && sessionTimeRef.current > 0) {
        syncWithBeacon(sessionTimeRef.current);
      }
      relinquishLeadership();
    };

    window.addEventListener('app:before-logout', handleBeforeLogout);
    return () => window.removeEventListener('app:before-logout', handleBeforeLogout);
  }, [syncWithBeacon, isLeader, relinquishLeadership]);

  // Fetch play time on mount when user is logged in
  useEffect(() => {
    if (user) {
      fetchPlayTime();
    } else {
      setServerTime(0);
      setSessionTime(0);
      setIsInitialized(false);
      relinquishLeadership();
    }
  }, [user, fetchPlayTime, relinquishLeadership]);

  // Leader election loop - continuously try to become/maintain leader
  useEffect(() => {
    if (!user || !isInitialized) {
      relinquishLeadership();
      return;
    }

    // Initial leader check
    tryBecomeLeader();

    // Periodic leader check/heartbeat
    leaderCheckRef.current = window.setInterval(() => {
      tryBecomeLeader();
    }, LEADER_HEARTBEAT_INTERVAL);

    return () => {
      if (leaderCheckRef.current) {
        clearInterval(leaderCheckRef.current);
        leaderCheckRef.current = undefined;
      }
    };
  }, [user, isInitialized, tryBecomeLeader, relinquishLeadership]);

  // Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LEADER_KEY) {
        // Another tab changed leader status, re-evaluate
        const newLeader = getLeaderInfo();
        if (newLeader?.tabId !== TAB_ID) {
          setIsLeader(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      setIsVisible(nowVisible);

      if (!nowVisible && isLeader && sessionTime > 0) {
        // Tab became hidden, sync to server
        syncToServer(sessionTime);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionTime, syncToServer, isLeader]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isLeader && sessionTime > 0) {
        syncWithBeacon(sessionTime);
      }
      relinquishLeadership();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionTime, syncWithBeacon, isLeader, relinquishLeadership]);

  // Timer that increments every second when visible AND we are the leader
  useEffect(() => {
    if (!user || !isVisible || !isInitialized || !isLeader) {
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
  }, [user, isVisible, isInitialized, isLeader, syncToServer]);

  // Periodically refetch server time for non-leader tabs to stay updated
  useEffect(() => {
    if (!user || !isInitialized || isLeader) return;

    // Non-leader tabs refresh server time every 30 seconds to stay in sync
    const refreshInterval = window.setInterval(() => {
      fetchPlayTime();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [user, isInitialized, isLeader, fetchPlayTime]);

  // Don't render if not logged in
  if (!user) {
    return null;
  }

  return (
    <div
      className="playtime-counter"
      title={`Total time spent in KLC: ${formatTimeVerbose(totalTime)}${isLeader ? ' (active)' : ' (syncing)'}`}
    >
      <Clock size={16} />
      <span className="playtime-counter-number">{formatTime(totalTime)}</span>
    </div>
  );
};

export default PlayTimeCounter;
