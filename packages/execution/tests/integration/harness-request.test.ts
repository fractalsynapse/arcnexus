import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import {
  Architecture,
  type ActivitySelection,
  type Capture,
} from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { HostTask } from '../../src/index.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['request-parity'],
} as const;

const actors = [
  { component: 'direction', activity: 'planning' },
  { component: 'subject', activity: 'implementation' },
  { component: 'reviewer', activity: 'assessment' },
] as const;
const remote = 'https://example.invalid/arcnexus/fixture.git';
const guidance = {
  'AGENTS.md': 'Fixture native directive.\n',
  '.agents/skills/probe/SKILL.md':
    '---\nname: probe\ndescription: Fixture skill\n---\nNative skill body.\n',
};
const files = { ...guidance, 'plan.md': 'Prepare an observable fixture plan.\n' };
const profiles = {
  fixture: {
    id: 'fixture',
    model: 'probe',
    reasoning: 'medium',
    webSearch: 'disabled',
    operationCategories: ['project-tool'],
  },
};
const operations = {
  'read-file': { id: 'read-file', category: 'project-tool', tool: 'read' },
  'list-files': { id: 'list-files', category: 'project-tool', tool: 'list' },
};

/** Compare the shared prepared request with what a native activation actually sends. */
class ActivationParity {
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-request-parity-'));
  private readonly project = join(this.root, 'project');
  private readonly execution = join(this.root, 'codex-fixture.mjs');
  private readonly storage = join(this.root, 'state');
  private readonly agent = new Agent(new Architecture());
  private readonly capture = this.fixtureCapture();
  private readonly goal = 'Exercise the complete request';
  private readonly task: HostTask;

  /** Prepare an explicit target and point the native provider at a disposable recorder. */
  constructor(t: TestContext) {
    mkdirSync(this.project);
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    this.writeGuidance();
    const module = new URL('../fixtures/harness-probe.js', import.meta.url);
    const launcher = `#!${process.execPath}\nimport { HarnessProbe } from ${JSON.stringify(module.href)};\nawait HarnessProbe.run(process.argv.slice(2));\n`;
    writeFileSync(this.execution, launcher, { mode: 0o700 });
    const journal = new Coordination(this.storage).admit(this.capture.source.remote, this.goal);
    assert('record' in journal);
    this.task = new HostTask(
      {
        capture: this.capture,
        common: this.project,
        executable: this.execution,
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      this.goal,
      journal,
    );
    t.after(() => this.task.close());
  }

  /** Verify production stdin, arguments and advertised tools for one actor. */
  async observe(selection: ActivitySelection) {
    const data = {
      assignment: 'Fixture assignment',
      milestone: 'fixture',
      acceptance: [],
      evidence: [],
    };
    const input = { ...data, goal: this.goal, worktree: this.project };
    const { request } = this.agent.prepareRequest(this.capture, selection, input);
    await this.task.activate(this.agent, selection, data, AbortSignal.timeout(10_000));
    const actual = JSON.parse(
      readFileSync(join(this.project, 'observed.json'), 'utf8'),
    ) as Observation;
    assert.equal(actual.input, request.input);
    for (const text of Object.values(guidance)) assert(!actual.input.includes(text.trim()));
    assert.equal(actual.cwd, request.options.workingDirectory);
    assert.deepEqual(
      actual.tools,
      request.options.tools.map(({ handler: _handler, ...tool }) => tool),
    );
    this.options(actual.argv, request.options);
  }

  /** Assert actual provider options while leaving native guidance discovery enabled. */
  private options(
    argv: readonly string[],
    options: ReturnType<Agent['prepareRequest']>['request']['options'],
  ) {
    assert.equal(argv[argv.indexOf('--model') + 1], options.model);
    assert.equal(argv[argv.indexOf('--cd') + 1], options.workingDirectory);
    assert(argv.includes(`model_reasoning_effort="${options.modelReasoningEffort}"`));
    assert(argv.includes(`web_search="${options.webSearchMode}"`));
    assert(argv.includes('--ignore-user-config'));
    assert(!argv.includes('--no-project-doc'));
    assert(
      !argv.some((arg) =>
        /^(?:project_doc_max_bytes|project_doc_fallback_filenames|features\.skills)=/.test(arg),
      ),
    );
  }

  /** Supply a small captured catalog with populated and explicitly empty operation lists. */
  private fixtureCapture(): Capture {
    return {
      source: {
        root: this.project,
        remote,
        revision: 'fixture',
        paths: Object.keys(files),
        read: (path) => files[path as keyof typeof files],
      },
      project: {
        id: 'fixture',
        remote,
        contractRegistry: 'registry.yaml',
        planTemplate: 'plan.md',
        director: actors[0],
        verifier: actors[2],
      },
      components: Object.fromEntries(
        actors.map(({ component, activity }, index) => [
          component,
          fixtureComponent(component, activity, index),
        ]),
      ),
      roles: { fixture: { id: 'fixture' } },
      profiles,
      operations,
      standards: {},
      contracts: [],
    };
  }

  /** Track exact project directives and skill files without exercising model discovery. */
  private writeGuidance() {
    for (const [path, text] of Object.entries(files)) {
      const file = join(this.project, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
    this.git('init', '-q');
    this.git('add', '--', ...Object.keys(files));
  }

  /** Track the fixture's captured guidance with the actual local Git client. */
  private git(...args: string[]) {
    execFileSync('git', args, { cwd: this.project, stdio: 'ignore' });
  }
}

interface Observation {
  input: string;
  cwd: string;
  argv: string[];
  tools: unknown[];
}

/** Map each actor to a distinguishable set of operations. */
function fixtureComponent(id: string, activity: string, index: number) {
  const operations = [['read-file'], ['read-file', 'list-files'], []][index]!;
  return {
    id,
    purpose: 'Exercise one actor',
    owns: ['fixture'],
    activities: {
      [activity]: {
        role: 'fixture',
        profile: 'fixture',
        instructions: [],
        standards: [],
        operations,
      },
    },
  };
}

for (const selection of actors) {
  test(`the ${selection.component} activation sends its exact complete request and mapped MCP tools`, async (t) => {
    await new ActivationParity(t).observe(selection);
  });
}
