import { useState } from 'react';

/** Keep pending and failure feedback with the currently rendered command controls. */
export function useCommandAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const perform = async (action: () => Promise<void>, fallback: string) => {
    setPending(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setPending(false);
    }
  };
  return { pending, error, perform };
}
