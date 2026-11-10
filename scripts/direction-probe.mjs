/**
 * Direction-stage probe: run the production planning path and stop at the admission boundary.
 *
 * This is a mirror, not a second engine. It builds the same `ProjectExecution` context, the same
 * isolated workspace and policy capture, the same `directionInput`, and then calls the very same
 * `Direction.propose()` and `AssignmentDispatch.apply()` the host uses inside a task run. The only
 * thing it withholds is what comes after admission: no steward activation, no tracking issue, no
 * push. Nothing here reimplements planning, validation or admission, so a plan that looks good in a
 * probe is a plan the host would actually have admitted - and a plan that fails the linter is a
 * defect in direction, not in the rig.
 *
 * Two modes exist because they answer different questions at very different cost:
 *   live   - one real, confined, source-read-only model activation; captures prompt and response.
 *   replay - feeds a previously captured director result back through admission with no model call,
 *            which makes host-stage behaviour (admission, ordering, eligibility) deterministic.
 *
 * Captures are written under application storage, never into the repository.
 *
 * Usage:
 *   node scripts/direction-probe.mjs --goal "<text>" [--mode live|replay] [--from <capture-dir>]
 *                                    [--corpus <file> --scenario <id>] [--state <dir>]
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ExecutionContext } from '../dist/library/architecture/execution-context.js';
import { ExecutionStore } from '../dist/library/coordination-store/execution-store.js';
import { AssignmentDispatch } from '../dist/library/execution-runtime/assignment-dispatch.js';
import { RunWorkspace } from '../dist/library/execution-runtime/run-workspace.js';
import { ExecutionReports } from '../dist/library/report/report.js';

/** Arguments for one probe run, resolved defensively so a mistake fails loudly rather than silently. */
function options(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 2) flags.set(argv[i], argv[i + 1]);
  const mode = flags.get('--mode') ?? 'live';
  if (!['live', 'replay'].includes(mode)) throw new Error('Unknown probe mode: ' + mode);
  const state = flags.get('--state') ?? join(tmpdir(), 'arcnexus-direction-probe');
  const corpus = flags.get('--corpus');
  let goal = flags.get('--goal');
  let scenario = flags.get('--scenario');
  if (corpus && scenario) {
    const entry = loadCorpus(corpus).find((item) => item.id === scenario);
    if (!entry) throw new Error('Unknown corpus scenario: ' + scenario);
    goal = entry.goal;
  }
  if (!goal && mode === 'live')
    throw new Error('A live probe requires --goal or --corpus with --scenario');
  return { mode, goal, scenario, state, from: flags.get('--from'), repo: resolve('.'), corpus };
}

/** Reads the scenario file; a corpus is data the probe plans over, never configuration it trusts. */
function loadCorpus(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8')).scenarios ?? [];
}

/** Creates a throwaway project store and task run, the same shapes the host lane uses. */
function lane(root, context, goal) {
  const store = new ExecutionStore(join(root, 'execution.sqlite'));
  const run = store.createRun('task', context.owners, goal);
  store.updateRun(run.id, 'running', { prompt: goal });
  return { store, run: store.run(run.id) };
}

/** Runs the production direction call and returns its result plus the artifacts the prompt used. */
async function plan(root, context, store, run, goal, signal) {
  const workspaces = new RunWorkspace(root, context, store);
  await workspaces.prepare(run, signal);
  const prepared = store.run(run.id);
  const input = workspaces.directionInput(prepared, new ExecutionReports(root, store));
  const workspace = await workspaces.policy(prepared, signal);
  const result = await workspaces.direction(prepared, signal).propose(workspace, input.prompt);
  return { result, prompt: input.prompt };
}

/** Admits a director result through the host's own validator, then reads back what became runnable. */
function admit(root, context, store, run, result) {
  new AssignmentDispatch(root, context, store).apply(store.run(run.id), result);
  return store.snapshot(() => store.requiredAssignments(run.id));
}

/**
 * The mechanical questions worth asking of every plan, before any agent costs anything.
 *
 * Each rule names a failure mode this project has actually hit: empty acceptance made the
 * per-criterion gate inert, and an unbounded team turned a small goal into a merge conflict.
 */
function lint(assigned, result, context) {
  const problems = [];
  if (!assigned.length && result.status === 'ready' && !result.summary)
    problems.push('ready with no justification recorded');
  for (const item of assigned) {
    if (!Array.isArray(item.acceptance) || !item.acceptance.length)
      problems.push(`assignment ${item.id.slice(0, 8)} carries no acceptance criteria`);
    if (item.objective.length < 24)
      problems.push(`assignment ${item.id.slice(0, 8)} objective is not substantive`);
  }
  const owners = [...new Set(assigned.map((item) => item.owner))];
  for (const owner of owners)
    if (!context.catalog.components[owner]) problems.push('unknown owner proposed: ' + owner);
  const ids = new Set(assigned.map((item) => item.id));
  for (const item of assigned)
    for (const dependency of item.dependencies ?? [])
      if (!ids.has(dependency)) problems.push('dependency outside the plan: ' + dependency);
  if (assigned.length > 4)
    problems.push(`${assigned.length} assignments for one goal: check for fan-out`);
  return { owners, problems, assignments: assigned.length };
}

/** Writes one capture directory outside source and returns its path. */
function persist(root, options_, prompt, result, assigned, report) {
  const id = createHash('sha256')
    .update(String(options_.goal) + options_.mode)
    .digest('hex')
    .slice(0, 16);
  const directory = join(root, 'projects', 'probe', 'direction', id);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(directory, 'request.json'),
    JSON.stringify(
      { goal: options_.goal, scenario: options_.scenario, mode: options_.mode },
      null,
      2,
    ),
  );
  writeFileSync(join(directory, 'prompt.txt'), prompt ?? '');
  writeFileSync(join(directory, 'director-result.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(join(directory, 'admitted.json'), JSON.stringify(assigned, null, 2) + '\n');
  writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return directory;
}

/** Prints the outcome so a human can read the plan, and an exit code a script can trust. */
function announce(directory, report) {
  console.log(JSON.stringify({ capture: directory, ...report }, null, 2));
  process.exitCode = report.problems.length ? 1 : 0;
}

async function main() {
  const options_ = options(process.argv.slice(2));
  const root = join(options_.state, 'arcnexus', 'state');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const context = new ExecutionContext().resolve(options_.repo);
  const signal = new AbortController().signal;
  const { store, run } = lane(root, context, options_.goal ?? 'replayed direction capture');
  let result;
  let prompt;
  if (options_.mode === 'live') {
    ({ result, prompt } = await plan(root, context, store, run, options_.goal, signal));
  } else {
    if (!options_.from || !existsSync(join(options_.from, 'director-result.json')))
      throw new Error('replay requires --from <capture directory> holding a director-result.json');
    result = JSON.parse(readFileSync(join(options_.from, 'director-result.json'), 'utf8'));
    prompt = readFileSync(join(options_.from, 'prompt.txt'), 'utf8');
  }
  const assigned = result.status === 'ready' ? admit(root, context, store, run, result) : [];
  const checks = lint(assigned, result, context);
  const report = {
    mode: options_.mode,
    status: result.status,
    selectedOwners: result.selectedOwners ?? [],
    questions: (result.questions ?? []).length,
    summary: result.summary ?? '',
    ...checks,
  };
  announce(persist(root, options_, prompt, result, assigned, report), report);
  store.close();
}

main().catch((error) => {
  console.error('direction probe failed: ' + String(error));
  process.exitCode = 2;
});
