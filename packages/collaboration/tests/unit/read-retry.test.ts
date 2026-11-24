import assert from 'node:assert/strict';
import test from 'node:test';
import { retryRead } from '../../src/read.js';

export const suite = { owner: 'collaboration', level: 'unit', tags: ['regression'] } as const;

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

test('GitHub CLI service unavailability while checking a PR is retried as a read', async () => {
  let attempts = 0;
  const result = await retryRead(async () => {
    if (++attempts === 1)
      throw new Error(
        'Command failed: /usr/bin/gh pr view\nHTTP 503: 503 Service Unavailable (https://api.github.com/graphql)\n',
      );
    return 'checked';
  }, new AbortController().signal);
  assert.equal(result, 'checked');
  assert.equal(attempts, 2);
});

test('transient provider reads recover without an application retry-count ceiling', async () => {
  let calls = 0;
  const result = await retryRead(async () => {
    if (++calls < 6) throw new Error('Provider unavailable (HTTP 503)');
    return 'observed';
  }, new AbortController().signal);
  assert.equal(result, 'observed');
  assert.equal(calls, 6);
});
