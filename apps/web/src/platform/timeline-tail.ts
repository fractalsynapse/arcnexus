import { useLayoutEffect, useRef } from 'react';

function visibleTail(log: HTMLElement) {
  const frame = log.closest('.arc-app');
  const dock = frame?.querySelector('footer');
  const nav = frame?.querySelector('nav');
  const bottom = Math.min(innerHeight, dock?.getBoundingClientRect().top ?? innerHeight);
  return {
    bottom,
    top: Math.max(0, nav?.getBoundingClientRect().bottom ?? 0),
    tail: log.getBoundingClientRect().bottom,
  };
}

/** Follow new events on the page while the reader can see the end of the log. */
export function useTimelineTail(path: string | undefined, active: boolean, sequence?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const observe = () => {
      if (!ref.current) return;
      const { bottom, top, tail } = visibleTail(ref.current);
      following.current =
        tail > top && Math.floor(tail) <= Math.ceil(bottom) ? window.scrollY : undefined;
    };
    observe();
    window.addEventListener('scroll', observe, { passive: true });
    window.addEventListener('resize', observe);
    return () => {
      window.removeEventListener('scroll', observe);
      window.removeEventListener('resize', observe);
    };
  }, [path]);
  useLayoutEffect(() => {
    if (!active || following.current !== window.scrollY || !ref.current) return;
    const { bottom, tail } = visibleTail(ref.current);
    if (tail > bottom) {
      window.scrollBy(0, tail - bottom);
      following.current = window.scrollY;
    }
  }, [active, path, sequence]);
  return { ref };
}
