import { useLayoutEffect, useRef } from 'react';
import type { UIEvent } from 'react';

/** Follow live entries while the reader stays at the bottom of the event log. */
export function useTimelineTail(path: string | undefined, active: boolean, sequence?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    following.current = true;
    if (ref.current) ref.current.scrollTop = 0;
  }, [path]);
  useLayoutEffect(() => {
    if (active && following.current && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [path, active, sequence]);
  return {
    ref,
    onScroll: ({ currentTarget }: UIEvent<HTMLDivElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = currentTarget;
      following.current = Math.ceil(scrollTop + clientHeight) >= scrollHeight;
    },
  };
}
