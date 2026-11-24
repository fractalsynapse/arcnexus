import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Agent } from '../../../agent/src/index.js';
import { Execution, type HostTask } from '../../src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
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
  refusals: Array<{ isError?: boolean; content: Array<{ text: string }> }>;
  guidance: string;
  skill: string;
}

/** Require exact public advertised metadata, so renamed or stale tool descriptions cannot pass. */
function assertTools(view: AgentInspection, probe: Probe) {
  const expected = view.request.options.tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
  assert.deepEqual(probe.tools, expected);
  const section = view.request.input.split('## Operations\n')[1]!.split('\n\n## Standards')[0]!;
  const operations = parse(section.slice(section.indexOf('\n\n') + 2));
  assert.deepEqual(
    Object.keys(operations),
    expected.map(({ name }) => name),
  );
  for (const tool of expected) assert.equal(operations[tool.name].mcp, tool.description);
  assert.equal(probe.refusals.length, expected.some(({ name }) => name === 'owned-edit') ? 3 : 2);
  assert.ok(probe.refusals.every(({ isError }) => isError));
  for (const refusal of probe.refusals.slice(0, 2))
    assert.match(refusal.content[0]!.text, /not mapped to this activity/);
  if (probe.refusals[2])
    assert.match(probe.refusals[2].content[0]!.text, /captured owners: reviewer/);
}

/** Assert effective native invocation policy and visible guidance without claiming harness interpretation. */
function assertInvocation(view: AgentInspection, probe: Probe) {
  const options = view.request.options;
  assert.equal(probe.cwd, options.workingDirectory);
  assert.equal(probe.args[probe.args.indexOf('--model') + 1], options.model);
  assert.equal(probe.args[probe.args.indexOf('--cd') + 1], options.workingDirectory);
  assert.ok(
    probe.args.includes('model_reasoning_effort=' + JSON.stringify(options.modelReasoningEffort)),
  );
  assert.ok(probe.args.includes('web_search=' + JSON.stringify(options.webSearchMode)));
  assert.ok(probe.args.includes('features.shell_tool=false'));
  assert.ok(probe.args.includes('features.unified_exec=false'));
  assert.ok(!probe.args.some((arg) => /project_doc_max_bytes=0|skills.enabled=false/.test(arg)));
  assert.equal(probe.guidance, guidance);
  assert.equal(probe.skill, skill);
  assert.equal(probe.node, process.version);
  assert.doesNotMatch(probe.input, /Approved native guidance sentinel|Approved skill sentinel/);
}

/** Supply identical live inputs, including the host's independently retained reviewer observation. */
function context(task: HostTask, review = false) {
  const evidence: string[] = [];
  if (review) {
    const diff = task.evidence.find((path) => path.endsWith('activity.diff'));
    assert.ok(diff, 'review activation supplies its candidate diff observation');
    assert.equal(readFileSync(diff, 'utf8'), '');
    evidence.push(diff);
  }
  return {
    assignment: { instructions: 'Exact supplied assignment\nSecond line' },
    milestone: { id: 'parity', owner: 'work' },
    acceptance: [{ id: 'exact' }],
    evidence,
    goal: task.goal,
    worktree: task.worktree,
  };
}

/** Author registered round inputs independently of the request builder and retain the live timeline. */
function enrichment(task: HostTask) {
  task.listen(() => undefined);
  const report = task.store('prior-round.md', 'Prior round finding\nFinal line.\n');
  const round = { invocation: 'prior-invocation', round: '1' as const, report };
  const completedRound = { ...round, findings: [], measurements: [], evidence: [report] };
  task.record({ completedRound });
  task.record({
    completedRound: {
      ...round,
      round: '2',
      report: report + '.unregistered',
      findings: [],
      measurements: [],
      evidence: [],
    },
  });
  return {
    assignment: { ...context(task).assignment, completedRounds: [round] },
    evidence: [report, task.timeline!],
  };
}

/** Compose identical enriched task inputs while preserving the independent reviewer diff. */
function liveContext(task: HostTask, enriched: ReturnType<typeof enrichment>, review = false) {
  const supplied = context(task, review);
  return {
    ...supplied,
    assignment: enriched.assignment,
    evidence: [...supplied.evidence, ...enriched.evidence],
  };
}

/** Assert selected source content independently of the comparison between the two request paths. */
function assertSelected(
  view: AgentInspection,
  actor: string,
  names: readonly string[],
  web: string,
) {
  const source = '.arc/architecture/components/' + view.component + '.yaml';
  assert.equal(view.actor, actor);
  assert.deepEqual(view.placeholders, []);
  assert.deepEqual(
    view.request.options.tools.map(({ name }) => name),
    names,
  );
  assert.equal(view.request.options.webSearchMode, web);
  assert.ok(
    view.request.input.includes(
      'purpose: Assess ' + view.component + ' using complete retained findings',
    ),
  );
  assert.ok(
    view.request.input.includes(
      'Selected ' + view.component + '/' + view.activity + ' procedure café 🛠',
    ),
  );
  assert.ok(
    view.request.input.includes('Source: ' + source + ' (activities.' + view.activity + ')'),
  );
  assert.ok(view.request.input.includes('Source: .arc/architecture/roles/assessor.yaml'));
}

/** Read the actual complete subprocess observation from Execution's native transcript. */
function readProbe(task: HostTask, last = false): Probe {
  const transcripts = task.evidence.filter((path) => path.endsWith('codex.jsonl'));
  const transcript = last ? transcripts.at(-1) : transcripts[0];
  assert.ok(transcript);
  const frames = readFileSync(transcript, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const probe = frames.find((event) => event.type === 'fixture.inspection') as Probe;
  assert.ok(probe, 'controlled executable must actually receive the request');
  return probe;
}

for (const [component, activity, actor, names, web] of [
  ['director', 'planning', 'director', ['inspect-read'], 'cached'],
  ['work', 'testing', 'steward', ['inspect-read', 'owned-edit'], 'disabled'],
  ['work', 'documentation', 'steward', ['inspect-list'], 'disabled'],
  ['work', 'empty', 'steward', [], 'disabled'],
  ['work', 'empty-web', 'steward', [], 'live'],
  ['reviewer', 'review', 'reviewer', ['inspect-read'], 'disabled'],
] as const) {
  test('complete CLI inspection parity for ' + component + '/' + activity, (t) => {
    const fixture = new InspectionFixture(t);
    const cli = fileURLToPath(new URL('../../../../apps/cli/src/index.js', import.meta.url));
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [cli, 'inspect', component, activity, ...args], {
        cwd: fixture.root,
        encoding: 'utf8',
      });
    const view = fixture.agent.inspect({ directory: fixture.root, component, activity });
    assert.deepEqual(JSON.parse(run('--json')), view);
    const rendered = run();
    const marker = '--- Codex input ---\n';
    const start = rendered.indexOf(marker);
    assert.ok(start >= 0);
    const header = rendered.slice(0, start);
    const options = header.indexOf('Invocation options:\n');
    assert.ok(options >= 0);
    assert.equal(header.slice(0, options), 'Placeholders: ' + view.placeholders.join(', ') + '\n');
    assert.deepEqual(
      JSON.parse(header.slice(options + 'Invocation options:\n'.length)),
      view.request.options,
    );
    assert.equal(rendered.slice(start + marker.length), view.request.input + '\n');
  });

  test('EX-6/EX-16: native inspection parity for ' + component + '/' + activity, async (t) => {
    const fixture = new InspectionFixture(t);
    const task = await fixture.open(t);
    const selection = { component, activity };
    const enriched = enrichment(task);
    const supplied = liveContext(task, enriched);
    const initial = fixture.agent.prepareRequest(task.capture, selection, supplied);
    assertSelected(initial, actor, names, web);
    await task.activate(fixture.agent, selection, context(task), new AbortController().signal);
    const view = fixture.agent.prepareRequest(
      task.capture,
      selection,
      liveContext(task, enriched, actor === 'reviewer'),
    );
    const probe = readProbe(task);
    t.diagnostic(
      JSON.stringify({
        controlledNativeObservation: { revision: task.capture.source.revision, probe },
      }),
    );
    assert.equal(probe.executable, task.config.executable);
    assert.equal(probe.input, view.request.input);
    assertTools(view, probe);
    assertInvocation(view, probe);
    assert.equal(
      readFileSync(join(task.worktree!, 'review/foreign.txt'), 'utf8'),
      'foreign original\n',
    );
  });
}

test('native activation mounts the target of a symlinked Codex executable', async (t) => {
  const fixture = new InspectionFixture(t);
  const executable = join(fixture.root, '.git', 'inspection-provider.mjs');
  const alias = join(fixture.root, '.git', 'codex');
  symlinkSync(executable, alias);
  fixture.write('.git/bindings.yaml', { schemaVersion: 1, tools: { codex: alias } });
  const task = await fixture.open(t);
  await task.activate(
    fixture.agent,
    { component: 'work', activity: 'testing' },
    context(task),
    new AbortController().signal,
  );
  const probe = readProbe(task);
  assert.equal(probe.executable, alias);
  const filesystem = probe.args.find((arg) => arg.startsWith('permissions.arcnexus.filesystem='));
  assert.ok(filesystem);
  assert.ok(filesystem.includes(JSON.stringify(executable) + '="read"'));
  assert.ok(!filesystem.includes(JSON.stringify(alias) + '="read"'));
});

test('inspection is repeatable with named live inputs and no admission, provider or worktree effects', (t) => {
  const fixture = new InspectionFixture(t);
  t.mock.method(Agent.prototype, 'activate', () => assert.fail('Inspection called a model'));
  t.mock.method(Execution.prototype, 'admit', () => assert.fail('Inspection admitted a task'));
  for (const method of ['issue', 'push', 'publication'] as const)
    t.mock.method(GitHub.prototype, method, () => assert.fail('Inspection reached upstream'));
  const before = fixture.git('worktree', 'list', '--porcelain');
  const status = fixture.git('status', '--porcelain');
  const view = fixture.agent.inspect({
    directory: fixture.root,
    component: 'work',
    activity: 'testing',
  });
  assert.deepEqual(view.placeholders, [
    '<assignment>',
    '<goal>',
    '<milestone>',
    '<acceptance>',
    '<evidence>',
    '<worktree>',
  ]);
  assert.deepEqual(
    view,
    fixture.agent.inspect({ directory: fixture.root, component: 'work', activity: 'testing' }),
  );
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
    await assert.rejects(
      async () =>
        task.activate(
          fixture.agent,
          { component: 'work', activity: 'empty' },
          {},
          new AbortController().signal,
        ),
      /Captured project guidance differs/,
    );
    assert.equal(
      task.evidence.some((path) => path.endsWith('native-request.json')),
      false,
    );
  } finally {
    writeFileSync(path, guidance);
  }
});

test('current assembled CLI request-parity and inspection scenarios', (t) => {
  const paths = ['request-parity', 'inspect'].map((name) =>
    fileURLToPath(
      new URL('../../../../apps/cli/tests/integration/' + name + '.test.js', import.meta.url),
    ),
  );
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const log = execFileSync(process.execPath, ['--test', '--test-reporter=tap', ...paths], {
    encoding: 'utf8',
    env,
  });
  t.diagnostic(log);
  assert.match(log, /# fail 0/);
  assert.match(log, /# skipped 0/);
});

