import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import {
  Architecture,
  type ActivitySelection,
  type Capture,
  type TaskContext,
} from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { direct } from '../../../direction/src/index.js';
import { HostTask } from '../../src/index.js';

/** Record the complete inputs actually delivered to the shared request builder. */
class RecordingArchitecture extends Architecture {
  delivered?: { capture: Capture; selection: ActivitySelection; task?: TaskContext };

  /** Preserve the original builder and record its activation inputs. */
  override request(capture: Capture, selection: ActivitySelection, task?: TaskContext) {
    this.delivered = { capture, selection, task };
    return super.request(capture, selection, task);
  }
}

test('Director production activation forwards the shared request and mapped tools', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-director-parity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('./director-parity-fixture.js', import.meta.url));
  writeFileSync(
    executable,
    `#!/bin/sh
export PARITY_OBSERVATION="${observation}"
exec "${process.execPath}" "${fixture}" "$@"
`,
  );
  chmodSync(executable, 0o700);
  const architecture = new RecordingArchitecture();
  const capture = architecture.capture(process.cwd());
  const goal = 'Director parity fixture goal';
  const journal = new Coordination(root).admit(capture.source.remote, goal);
  assert(journal instanceof Journal);
  t.after(() => journal.close());
  const task = new HostTask(
    { capture, common: root, executable, base: 'staging', fresh: true, storage: root },
    goal,
    journal,
  );
  const agent = new Agent(architecture);
  await direct(agent, task, AbortSignal.timeout(10_000));
  const delivered = architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, capture);
  assert.deepEqual(delivered.selection, capture.project.director);
  assert.equal(delivered.task.goal, goal);
  assert.equal(delivered.task.milestone, 'Initial planning');
  assert.deepEqual(delivered.task.acceptance, []);
  const expected = new Agent(new Architecture()).prepareRequest(
    capture,
    delivered.selection,
    delivered.task,
  );
  const actual = JSON.parse(readFileSync(observation, 'utf8')) as {
    args: string[];
    input: string;
    cwd: string;
    tools: unknown[];
  };
  const options = expected.request.options;
  assert.equal(actual.input, expected.request.input);
  assert.match(
    actual.input,
    /Source: .arc\/architecture\/components\/direction.yaml \(activities.planning\)/,
  );
  assert.match(actual.input, /Source: Task inputs supplied at activation/);
  assert(actual.input.includes(goal));
  assert.equal(actual.cwd, options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--cd') + 1], options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--model') + 1], options.model);
  assert(
    actual.args.includes(`model_reasoning_effort=${JSON.stringify(options.modelReasoningEffort)}`),
  );
  assert(actual.args.includes(`web_search=${JSON.stringify(options.webSearchMode)}`));
  assert.deepEqual(
    actual.tools,
    options.tools.map(({ handler: _handler, ...tool }) => tool),
  );
});
