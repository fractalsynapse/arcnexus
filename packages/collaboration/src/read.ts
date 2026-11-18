import { setTimeout } from 'node:timers/promises';

const transientReadFailure =
  /\bi\/o timeout\b|connection reset by peer|TLS handshake timeout|temporary failure in name resolution|\(HTTP (?:500|502|503|504)\)/i;

/** Retry a read after a known transient provider failure while respecting task cancellation. */
export async function retryRead<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await read();
    } catch (error) {
      signal.throwIfAborted();
      if (attempt >= 2 || !(error instanceof Error) || !transientReadFailure.test(error.message))
        throw error;
      await setTimeout(250 * 2 ** attempt, undefined, { signal });
    }
  }
}
