import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { BridgeResponseBuffer } from '../../../../dist/library/steward/bridge-response-buffer.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises failed bridge startup in a real child process with a bounded test watchdog. */
class BridgeStartupScenarios {
  /** Rejects long socket addresses without leaking a listener or private directory. */
  longAddress(t: TestContext): void {
    const root = mkdtempSync(join(tmpdir(), 'bridge-startup-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const temporary = join(root, 'long-'.repeat(24));
    mkdirSync(temporary);
    const module = pathToFileURL(resolve('dist/library/steward/bridge.js')).href;
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import {openBridge} from ${JSON.stringify(module)};try{const b=await openBridge([],async()=>null);await b.close();process.exitCode=7}catch(e){console.log(e.message)}`,
      ],
      {
        env: { ...process.env, TMPDIR: temporary },
        encoding: 'utf8',
        timeout: 5000,
      },
    );
    assert.equal(result.status, 0, String(result.error ?? result.stderr));
    assert.match(result.stdout, /Private IPC path exceeds transport limit/);
    assert.deepEqual(readdirSync(temporary), []);
  }

  /** Preserves a multibyte character split between incoming response-byte chunks. */
  fragmentedUnicode(): void {
    const response = JSON.stringify({ id: 7, result: { value: 'before 🧬 after' } }) + '\n';
    const bytes = Buffer.from(response);
    const split = bytes.indexOf(Buffer.from('🧬')) + 2;
    const decoder = new BridgeResponseBuffer();

    assert.deepEqual(decoder.receive(bytes.subarray(0, split)), []);
    const frames = decoder.receive(bytes.subarray(split));
    assert.equal(JSON.parse(frames[0]!).result.value, 'before 🧬 after');
  }
}

const scenarios = new BridgeStartupScenarios();

test('bridge startup rejects overlong paths and releases all resources', (t) =>
  scenarios.longAddress(t));

test('bridge response preserves Unicode split across incoming chunks', () =>
  scenarios.fragmentedUnicode());

registerSuite({ component: 'steward', level: 'acceptance', tags: ['deterministic'] });
