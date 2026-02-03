import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import haptics from '../utils/haptics';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
}) => {
  const { isDark } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const pullDistance = useMotionValue(0);
  const hasTriggeredHaptic = useRef(false);

  const indicatorOpacity = useTransform(pullDistance, [0, PULL_THRESHOLD / 2, PULL_THRESHOLD], [0, 0.5, 1]);
  const indicatorScale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1]);
  const indicatorRotation = useTransform(pullDistance, [0, MAX_PULL], [0, 180]);

  const canPull = useCallback(() => {
    if (disabled || isRefreshing) return false;
    // Only allow pull when at top of scroll
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    return scrollTop <= 0;
  }, [disabled, isRefreshing]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!canPull()) return;
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    hasTriggeredHaptic.current = false;
  }, [canPull]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!canPull() || startY.current === 0) return;

    const touchY = e.touches[0].clientY;
    const diff = touchY - startY.current;

    if (diff > 0) {
      setIsPulling(true);
      // Apply resistance
      const resistance = 0.5;
      const pull = Math.min(diff * resistance, MAX_PULL);
      pullDistance.set(pull);
      currentY.current = touchY;

      // Haptic feedback when crossing threshold
      if (pull >= PULL_THRESHOLD && !hasTriggeredHaptic.current) {
        haptics.impact('medium');
        hasTriggeredHaptic.current = true;
      } else if (pull < PULL_THRESHOLD && hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = false;
      }

      // Prevent default scroll when pulling
      if (pull > 10) {
        e.preventDefault();
      }
    }
  }, [canPull, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    const pull = pullDistance.get();
    
    if (pull >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      haptics.success();
      
      // Animate to loading position
      animate(pullDistance, 60, { type: 'spring', damping: 20 });
      
      try {
        await onRefresh();
      } catch (e) {
        console.error('Refresh failed:', e);
        haptics.error();
      } finally {
        setIsRefreshing(false);
        animate(pullDistance, 0, { type: 'spring', damping: 20 });
      }
    } else {
      animate(pullDistance, 0, { type: 'spring', damping: 20 });
    }

    setIsPulling(false);
    startY.current = 0;
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        style={{
          top: -40,
          y: pullDistance,
          opacity: indicatorOpacity,
          scale: indicatorScale,
        }}
      >
        <motion.div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${isDark ? 'bg-white/10 text-white/80' : 'bg-black/5 text-gray-600'}
            shadow-lg backdrop-blur-sm
          `}
          style={{ rotate: indicatorRotation }}
          animate={isRefreshing ? { rotate: 360 } : undefined}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : undefined}
        >
          <RefreshCw size={20} />
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: pullDistance }}>
        {children}
      </motion.div>
    </div>
  );
};
