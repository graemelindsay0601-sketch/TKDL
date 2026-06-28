/**
 * Centralized Timer Context
 * 
 * OPTIMIZATION: Instead of each component running setInterval,
 * this context manages a single global timer that updates all
 * countdown displays in sync. Reduces:
 * - Battery drain on mobile (1 interval vs 10+)
 * - Re-renders (batched updates)
 * - Memory usage (single timer)
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface TimerState {
  hours: number;
  minutes: number;
  seconds: number;
}

interface TimerContextType {
  subscribeTimer: (key: string, endTime: number) => void;
  unsubscribeTimer: (key: string) => void;
  getTimer: (key: string) => TimerState | null;
  getAllTimers: () => Record<string, TimerState>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Record<string, { endTime: number; state: TimerState }>>({});
  const subscriptionsRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateAllTimers = () => {
      const now = Date.now();
      const newTimers: Record<string, { endTime: number; state: TimerState }> = {};
      let hasActive = false;

      for (const [key, endTime] of subscriptionsRef.current) {
        const diff = endTime - now;

        if (diff <= 0) {
          subscriptionsRef.current.delete(key);
          continue;
        }

        hasActive = true;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        newTimers[key] = {
          endTime,
          state: { hours, minutes, seconds },
        };
      }

      setTimers(newTimers);

      if (!hasActive && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (subscriptionsRef.current.size > 0 && !intervalRef.current) {
      updateAllTimers();
      intervalRef.current = setInterval(updateAllTimers, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const subscribeTimer = useCallback((key: string, endTime: number) => {
    subscriptionsRef.current.set(key, endTime);
  }, []);

  const unsubscribeTimer = useCallback((key: string) => {
    subscriptionsRef.current.delete(key);
  }, []);

  const getTimer = useCallback((key: string): TimerState | null => {
    return timers[key]?.state || null;
  }, [timers]);

  const getAllTimers = useCallback(() => {
    const result: Record<string, TimerState> = {};
    for (const [key, data] of Object.entries(timers)) {
      result[key] = data.state;
    }
    return result;
  }, [timers]);

  return (
    <TimerContext.Provider
      value={{
        subscribeTimer,
        unsubscribeTimer,
        getTimer,
        getAllTimers,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
}

export function useCountdown(key: string, endTime: number | null) {
  const timer = useTimer();

  useEffect(() => {
    if (endTime === null) {
      timer.unsubscribeTimer(key);
      return;
    }

    timer.subscribeTimer(key, endTime);

    return () => {
      timer.unsubscribeTimer(key);
    };
  }, [key, endTime, timer]);

  return timer.getTimer(key);
}
