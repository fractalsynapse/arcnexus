import { useEffect, useState } from 'react';

/** Advance a received readout with the browser's monotonic clock. */
export function useElapsedClock(running: boolean, reading: object) {
  const [tick, setTick] = useState<{ reading: object; offset: number }>();
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const timer = window.setInterval(
      () => setTick({ reading, offset: performance.now() - start }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [running, reading]);
  return running && tick?.reading === reading ? tick.offset : 0;
}

/** Display a duration as hours, minutes, and seconds. */
export function elapsedTime(milliseconds?: number | null) {
  if (milliseconds == null) return 'Unavailable';
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}
