import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';

export type Navigate = (event: MouseEvent<HTMLElement>, path: string) => void;

export function useWorkspacePath(): [string, Navigate] {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return [
    path,
    (event, destination) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      if (destination === path) return window.scrollTo(0, 0);
      window.history.pushState(null, '', destination);
      setPath(destination);
    },
  ];
}
