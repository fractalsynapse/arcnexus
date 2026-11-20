import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { Agent } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { direct, track } from '../../../direction/src/index.js';
import { Planner } from '../../../planner/src/index.js';
import { Workflow } from '../../../workflow/src/index.js';
import { Execution, hostTask, steward } from '../../src/index.js';
import { verify } from '../../../verification/src/index.js';
import { integrate, resume } from '../../../delivery/src/index.js';

const remote = 'https://github.com/example/round-consumption.git';
const catalog = '.arc/architecture';

/** Own a committed generic project, local Git transport and the production service composition. */
export class RoundConsumptionFixture {
  readonly directory = mkdtempSync(join(tmpdir(), 'execution-round-consumption-'));
  readonly root = join(this.directory, 'project');
  readonly storage = join(this.directory, 'state');
  readonly architecture = new Architecture();

  /** Supply every catalog binding explicitly without using developer provider configuration. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.directory, { recursive: true, force: true }));
    mkdirSync(this.root);
    this.git('init', '-b', 'staging');
    this.git('config', 'user.name', 'Fixture');
    this.git('config', 'user.email', 'fixture@example.invalid');
    this.git('remote', 'add', 'origin', remote);
    this.git('config', 'url.' + this.root + '.insteadOf', remote);
    for (const [path, body] of Object.entries(definitions())) {
      mkdirSync(dirname(join(this.root, path)), { recursive: true });
      writeFileSync(join(this.root, path), typeof body === 'string' ? body : stringify(body));
    }
    this.git('add', '.');
    this.git('commit', '-m', 'Explicit accepted refinement fixture');
    symlinkSync(
      fileURLToPath(new URL('../../../../../node_modules', import.meta.url)),
      join(this.root, '.git', 'node_modules'),
      'dir',
    );
    this.install('original');
  }

  /** Resolve the same public plugin services afresh over the existing SQLite/Git state. */
  reopen() {
    const agent = new Agent(this.architecture);
    return new Workflow({
      execution: new Execution(
        this.architecture,
        new Coordination(this.storage),
        this.storage,
      ),
      planner: new Planner(agent),
      architecture: {
        propose: (session, feedback, signal) =>
          this.architecture.propose(agent, hostTask(session), feedback, signal),
      },
      direction: {
        track,
        plan: (session, signal, standing) => direct(agent, session, signal, { standing }),
        revise: (session, plan, feedback, signal, standing) =>
          direct(agent, session, signal, { plan, feedback, standing }),
      },
      agent: {
        execute: (session, milestone, activity, signal) =>
          steward(agent, session, milestone, activity, signal),
      },
      verification: {
        assess: (session, plan, candidate, signal) =>
          verify(agent, session, plan, candidate, signal),
      },
      delivery: { integrate, resume },
    });
  }

  /** Bind an explicit installed executable; changing it never edits the captured project. */
  install(identity: string) {
    const executable = join(this.root, '.git', identity + '-provider.mjs');
    const source = readFileSync(
      fileURLToPath(new URL('./round-consumption-provider.js', import.meta.url)),
      'utf8',
    );
    writeFileSync(executable, source.replace(/^#![^\n]*/, '#!' + process.execPath), {
      mode: 0o700,
    });
    writeFileSync(
      join(this.root, '.git', 'bindings.yaml'),
      stringify({ schemaVersion: 1, tools: { codex: executable } }),
    );
    return executable;
  }

  /** Execute only isolated fixture repository operations with argv data. */
  git(...args: string[]) {
    return execFileSync('git', args, { cwd: this.root, encoding: 'utf8' }).trim();
  }
}

/** Declare real actor assignments and read/question tools with disjoint captured ownership. */
function definitions(): Record<string, unknown> {
  return {
    [catalog + '/project.yaml']: projectDefinition(),
    'contracts.yaml': { contracts: [] },
    [catalog + '/plan-template.md']: 'Use the normal five ordered activities.\n',
    '.arc/goals/baseline.md':
      '---\npriority: 1\n---\nPreserve the baseline.\n\n## Success measures\nThe baseline contains durable evidence.\n',
    baseline: 'durable evidence\n',
    ...actorDefinitions(),
    [catalog + '/roles/assessor.yaml']: {
      id: 'assessor',
      instructions: ['Assess the supplied assignment.'],
    },
    ...operationDefinitions(),
  };
}

/** Give each actual actor a distinguishable profile while keeping the catalog fully owned. */
function actorDefinitions() {
  const definitions: Record<string, unknown> = {};
  const owners = {
    planner: ['.arc/goals', '.arc/objectives'],
    architecture: [catalog, 'contracts.yaml'],
    direction: ['.arc/plans'],
    reviewer: ['review'],
    work: ['baseline'],
  };
  for (const [id, owns] of Object.entries(owners)) {
    definitions[catalog + '/components/' + id + '.yaml'] = actorDefinition(id, owns);
    definitions[catalog + '/execution-profiles/' + id + '.yaml'] = {
      id,
      model: 'explicit-' + id,
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: ['read'],
    };
  }
  return definitions;
}

/** Bind foreground assessment roles and the existing staging lifecycle in the committed catalog. */
function projectDefinition() {
  return {
    id: 'round-consumption',
    remote,
    knowledgeRoot: '.arc',
    contractRegistry: 'contracts.yaml',
    planTemplate: catalog + '/plan-template.md',
    bindings: '.git/bindings.yaml',
    director: { component: 'direction', activity: 'planning' },
    verifier: { component: 'reviewer', activity: 'review' },
    architect: { component: 'architecture', activity: 'assessment' },
    delivery: { baseBranch: 'staging', protectedBranch: 'main', requiredGates: [] },
    checks: { acceptance: ['fixture-check'] },
  };
}

/** Supply the explicit mapped read and human decision transport plus the admission check. */
function operationDefinitions() {
  return {
    [catalog + '/operations/read-file.yaml']: { id: 'read-file', category: 'read', tool: 'read' },
    [catalog + '/operations/ask-question.yaml']: {
      id: 'ask-question',
      category: 'read',
      tool: 'question',
    },
    [catalog + '/operations/fixture-check.yaml']: {
      id: 'fixture-check',
      category: 'check',
      tool: 'check',
      command: process.execPath,
      args: ['--version'],
      network: false,
    },
  };
}

/** Describe the activity that the normal request builder resolves for each actor. */
function actorDefinition(id: string, owns: string[]) {
  const activity = id === 'architecture' ? 'assessment' : id === 'reviewer' ? 'review' : 'planning';
  return {
    id,
    purpose: 'Assess ' + id + ' using complete retained findings',
    owns,
    activities: {
      [activity]: {
        role: 'assessor',
        profile: id,
        instructions: ['Use the real assignment and cite prior evidence.'],
        operations: ['read-file', 'ask-question'],
        standards: [],
      },
    },
  };
}
