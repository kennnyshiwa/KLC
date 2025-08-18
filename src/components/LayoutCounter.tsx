import React, { useState, useEffect, useRef } from 'react';
import { Database } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const LayoutCounter: React.FC = () => {
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(0);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetchLayoutCount();
    // Refresh count every 5 minutes
    const interval = setInterval(fetchLayoutCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (targetCount === null) return;

    // Calculate animation duration based on the count
    // Faster for smaller numbers, slower for larger ones
    const duration = Math.min(2000, Math.max(1000, targetCount * 2));
    const startTime = Date.now();
    const startCount = displayCount;

    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Use easeOutCubic for smooth deceleration
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentCount = Math.floor(startCount + (targetCount - startCount) * easeOutCubic);
      
      setDisplayCount(currentCount);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetCount]);

  const fetchLayoutCount = async () => {
    try {
      const response = await fetch(`${API_URL}/layouts/count`);
      if (response.ok) {
        const data = await response.json();
        setTargetCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch layout count:', error);
    }
  };

  // Always show the counter, even while loading (starting from 0)
  return (
    <div className="layout-counter" title={`${displayCount.toLocaleString()} layouts saved globally with KLC`}>
      <Database size={18} />
      <span className="layout-counter-number">{displayCount.toLocaleString()}</span>
      <span className="layout-counter-label">layouts</span>
    </div>
  );
};

export default LayoutCounter;