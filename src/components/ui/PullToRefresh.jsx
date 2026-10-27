import React, { useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const el = containerRef.current;
    if (el && el.scrollTop > 0) { startY.current = null; return; }
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      e.preventDefault();
      setPullDist(Math.min(dy * 0.5, THRESHOLD + 20));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDist >= THRESHOLD) {
      setRefreshing(true);
      setPullDist(0);
      startY.current = null;
      await onRefresh();
      setRefreshing(false);
    } else {
      setPullDist(0);
      startY.current = null;
    }
  }, [pullDist, onRefresh]);

  const progress = Math.min(pullDist / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto"
      style={{ overscrollBehavior: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-150"
        style={{ height: refreshing ? 48 : pullDist, opacity: refreshing ? 1 : progress }}
      >
        <Loader2 className={`w-5 h-5 text-blue-500 ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${progress * 180}deg)` }} />
      </div>
      {children}
    </div>
  );
}