import { setImmediate } from 'node:timers/promises';

const transientReadFailure =
  /\bi\/o timeout\b|connection reset by peer|TLS handshake timeout|temporary failure in name resolution|(?:^|\()HTTP (?:500|502|503|504)(?:\)|:)/im;

/** Retry a read after a known transient provider failure while respecting task cancellation. */
export async function retryRead<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  while (true) {
    signal.throwIfAborted();
    try {
      return await read();
    } catch (error) {
      signal.throwIfAborted();
      if (!isTransientReadFailure(error)) throw error;
      await setImmediate(undefined, { signal });
    }
  }
}

/** Classify provider transport failures consistently for synchronous and asynchronous reads. */
export function isTransientReadFailure(error: unknown) {
  return error instanceof Error && transientReadFailure.test(error.message);
}

/** Preserve a complete provider response when its decoded facts are unavailable. */
export function decodeGitHubResponse<T>(stdout: string, source: string, decode: () => T): T {
  try {
    return decode();
  } catch (cause) {
    const diagnostic = cause instanceof Error ? cause.message : String(cause);
    throw Object.assign(new Error(`GitHub read ${source}: ${diagnostic}`, { cause }), { stdout });
  }
}
