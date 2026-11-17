import { setTimeout } from 'node:timers/promises';

const transientTransport =
  /\bi\/o timeout\b|connection reset by peer|TLS handshake timeout|temporary failure in name resolution/i;

/** Retry a read after a known transient transport error while respecting task cancellation. */
export async function retryRead<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await read();
    } catch (error) {
      signal.throwIfAborted();
      if (attempt >= 2 || !(error instanceof Error) || !transientTransport.test(error.message))
        throw error;
      await setTimeout(250 * 2 ** attempt, undefined, { signal });
    }
  }
}
