import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { guidance, InspectionFixture, skill } from '../fixtures/inspection.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

interface Probe {
  input: string;
  args: string[];
  cwd: string;
  node: string;
  executable: string;
  tools: Array<{ name: string; description: string; inputSchema: unknown }>;
  refusals: Array<{ isError?: boolean }>;
  guidance: string;
  skill: string;
}

/** Require exact public advertised metadata, so renamed or stale tool descriptions cannot pass. */
function assertTools(view: AgentInspection, probe: Probe) {
  const expected = view.request.options.tools.map(({ name, description, inputSchema }) =>
    ({ name, description, inputSchema }));
  assert.deepEqual(probe.tools, expected);
  const section = view.request.input.split('## Operations\n')[1]!.split('\n\n## Standards')[0]!;
  const operations = parse(section.slice(section.indexOf('\n\n') + 2));
  assert.deepEqual(Object.keys(operations), expected.map(({ name }) => name));
  for (const tool of expected) assert.equal(operations[tool.name].mcp, tool.description);
  assert.ok(probe.refusals.every(({ isError }) => isError));
}

/** Assert effective native invocation policy and visible guidance without claiming harness interpretation. */
function assertInvocation(view: AgentInspection, probe: Probe) {
  const options = view.request.options;
  assert.equal(probe.cwd, options.workingDirectory);
  assert.equal(probe.args[probe.args.indexOf('--model') + 1], options.model);
  assert.equal(probe.args[probe.args.indexOf('--cd') + 1], options.workingDirectory);
  assert.ok(probe.args.includes('model_reasoning_effort=' + JSON.stringify(options.modelReasoningEffort)));
  assert.ok(probe.args.includes('web_search=' + JSON.stringify(options.webSearchMode)));
  assert.ok(probe.args.includes('features.shell_tool=false'));
  assert.ok(probe.args.includes('features.unified_exec=false'));
  assert.ok(!probe.args.some((arg) => /project_doc_max_bytes=0|skills.enabled=false/.test(arg)));
  assert.equal(probe.guidance, guidance);
  assert.equal(probe.skill, skill);
  assert.equal(probe.node, process.version);
  assert.doesNotMatch(probe.input, /Approved native guidance sentinel|Approved skill sentinel/);
}

for (const [component, activity, actor, names, web] of [
  ['director', 'planning', 'director', ['inspect-read'], 'cached'],
  ['work', 'testing', 'steward', ['inspect-read', 'owned-edit'], 'disabled'],
  ['work', 'documentation', 'steward', ['inspect-list'], 'disabled'],
  ['work', 'empty', 'steward', [], 'disabled'],
  ['work', 'empty-web', 'steward', [], 'live'],
  ['reviewer', 'review', 'reviewer', ['inspect-read'], 'disabled'],
] as const) {
  test('EX-6/EX-16: native inspection parity for ' + component + '/' + activity, async (t) => {
    const fixture = new InspectionFixture(t);
    const task = await fixture.open(t);
    const selection = { component, activity };
    const data = { assignment: { instructions: 'Exact supplied assignment\nSecond line' },
      milestone: { id: 'parity', owner: 'work' }, acceptance: [{ id: 'exact' }], evidence: [] };
    const view = fixture.agent.prepareRequest(task.capture, selection,
      { ...data, goal: task.goal, worktree: task.worktree });
    assert.equal(view.actor, actor);
    assert.deepEqual(view.placeholders, []);
    assert.deepEqual(view.request.options.tools.map(({ name }) => name), names);
    assert.equal(view.request.options.webSearchMode, web);
    await task.activate(fixture.agent, selection, data, new AbortController().signal);
    const transcript = task.evidence.find((path) => path.endsWith('codex.jsonl'));
    assert.ok(transcript);
    const frames = readFileSync(transcript, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const probe = frames.find((event) => event.type === 'fixture.inspection') as Probe;
    assert.ok(probe, 'controlled executable must actually receive the request');
    assert.equal(probe.executable, task.config.executable);
    assert.equal(probe.input, view.request.input);
    assertTools(view, probe);
    assertInvocation(view, probe);
    assert.equal(readFileSync(join(task.worktree!, 'review/foreign.txt'), 'utf8'), 'foreign original\n');
  });
}

test('inspection is repeatable with named live inputs and no admission, provider or worktree effects', (t) => {
  const fixture = new InspectionFixture(t);
  const before = fixture.git('worktree', 'list', '--porcelain');
  const status = fixture.git('status', '--porcelain');
  const view = fixture.agent.inspect({ directory: fixture.root, component: 'work', activity: 'testing' });
  assert.deepEqual(view.placeholders, ['<assignment>', '<goal>', '<milestone>', '<acceptance>', '<evidence>', '<worktree>']);
  assert.deepEqual(view, fixture.agent.inspect({ directory: fixture.root, component: 'work', activity: 'testing' }));
  assert.equal(fixture.git('worktree', 'list', '--porcelain'), before);
  assert.equal(fixture.git('status', '--porcelain'), status);
  assert.equal(existsSync(fixture.storage), false);
});

test('production activation refuses changed native guidance before starting the executable', async (t) => {
  const fixture = new InspectionFixture(t);
  const task = await fixture.open(t);
  const path = join(task.worktree!, 'AGENTS.md');
  writeFileSync(path, guidance + 'Candidate instruction');
  try {
    await assert.rejects(async () => task.activate(fixture.agent,
      { component: 'work', activity: 'empty' }, {}, new AbortController().signal),
    /Captured project guidance differs/);
    assert.equal(task.evidence.some((path) => path.endsWith('native-request.json')), false);
  } finally {
    writeFileSync(path, guidance);
  }
});
