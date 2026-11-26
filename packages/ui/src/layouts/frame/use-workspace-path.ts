import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';

export type Navigate = (event: MouseEvent<HTMLElement>, path: string) => void;

function location() {
  return window.location.pathname + window.location.search;
}

export function useWorkspacePath() {
  const [path, setPath] = useState(location);
  useEffect(() => {
    const update = () => setPath(location());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate: Navigate = (event, destination) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (!destination.startsWith('/') || destination.startsWith('//') || destination.includes('#'))
      return;
    event.preventDefault();
    if (destination === path) return window.scrollTo(0, 0);
    window.history.pushState({ arcInApp: true }, '', destination);
    setPath(location());
  };
  const back = (parent: string) => {
    if (window.history.state?.arcInApp) return window.history.back();
    window.history.replaceState(null, '', parent);
    setPath(location());
  };
  return { path, navigate, back };
}
