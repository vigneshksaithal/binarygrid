import { writable } from 'svelte/store';

const TIMER_INTERVAL_MS = 1000;

type TimerState = {
  seconds: number;
  isRunning: boolean;
};

const createTimerStore = () => {
  const { subscribe, update } = writable<TimerState>({
    seconds: 0,
    isRunning: false,
  });

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    update(state => {
      if (state.isRunning) return state;
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        update(s => ({ ...s, seconds: s.seconds + 1 }));
      }, TIMER_INTERVAL_MS);
      return { ...state, isRunning: true };
    });
  };

  const stop = () => {
    update(state => {
      if (!state.isRunning) return state;
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      return { ...state, isRunning: false };
    });
  };

  const reset = () => {
    update(state => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      return { seconds: 0, isRunning: false };
    });
  };

  return {
    subscribe,
    start,
    stop,
    reset,
  };
};

export const timer = createTimerStore();