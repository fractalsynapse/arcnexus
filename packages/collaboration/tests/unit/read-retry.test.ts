import assert from 'node:assert/strict';
import test from 'node:test';
import { retryRead } from '../../src/read.js';

type Reader = <T>(read: () => Promise<T>, signal: AbortSignal) => Promise<T>;

/** Exercise provider failure handling without access to live GitHub. */
class ReadRetryScenario {
  /** Return the provider observation after one transient error. */
  static async recovers(read: Reader) {
    let attempts = 0;
    const result = await read(async () => {
      if (++attempts === 1) throw new Error('dial tcp 192.0.2.1:443: i/o timeout');
      return 'merged';
    }, new AbortController().signal);
    assert.equal(result, 'merged');
    assert.equal(attempts, 2);
  }

  /** Keep permanent errors and cancellation visible to the caller. */
  static async stops(read: Reader) {
    const controller = new AbortController();
    const permanent = new Error('HTTP 403: access refused');
    let attempts = 0;
    await assert.rejects(
      read(async () => {
        attempts++;
        throw permanent;
      }, controller.signal),
      permanent,
    );
    assert.equal(attempts, 1);
    controller.abort();
    await assert.rejects(
      read(async () => {
        attempts++;
      }, controller.signal),
      { name: 'AbortError' },
    );
    assert.equal(attempts, 1);
  }
}

test('a known transport timeout is retried with no hosted access', async () => {
  await ReadRetryScenario.recovers(retryRead);
  await ReadRetryScenario.stops(retryRead);
});

test('a temporarily unavailable GitHub comparison is retried as a read', async () => {
  let attempts = 0;
  const result = await retryRead(async () => {
    if (++attempts === 1)
      throw new Error(
        'gh: Server Error: Sorry, this diff is temporarily unavailable due to heavy server load. (HTTP 500)',
      );
    return 'identical';
  }, new AbortController().signal);
  assert.equal(result, 'identical');
  assert.equal(attempts, 2);
});
