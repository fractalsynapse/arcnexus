import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { Agent } from '../../../agent/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution, HostTask } from '../../src/index.js';
import { RoundConsumptionFixture } from './round-consumption.js';

const catalog = '.arc/architecture';
export const guidance = 'Approved native guidance sentinel café 🛠\n';
export const skill =
  '---\nname: example\ndescription: Explicit fixture skill\n---\nApproved skill sentinel\n';

/** Own realistic committed captures and real admission without borrowing developer configuration. */
export class InspectionFixture extends RoundConsumptionFixture {
  private readonly sessions: HostTask[];
  readonly agent = new Agent(this.architecture);

  /** Extend the generic catalog with disjoint activities and independently controlled web profiles. */
  constructor(t: TestContext) {
    const sessions: HostTask[] = [];
    t.after(() => {
      for (const task of sessions) {
        task.cleanup();
        task.close();
      }
    });
    super(t);
    this.sessions = sessions;
    this.configureActors();
    this.write('AGENTS.md', guidance);
    this.write('.agents/skills/example/SKILL.md', skill);
    this.write('review/foreign.txt', 'foreign original\n');
    for (const [id, tool] of Object.entries({
      'inspect-read': 'read',
      'inspect-list': 'list',
      'owned-edit': 'edit',
      'foreign-write': 'edit',
    }))
      this.write(catalog + '/operations/' + id + '.yaml', { id, category: 'read', tool });
    this.git('add', '.');
    this.git('commit', '-m', 'Capture explicit inspection parity activities and guidance');
    this.installProbe();
  }

  /** Admit through production validation and materialize the actual issue branch before activation. */
  async open(t: TestContext) {
    const execution = new Execution(
      this.architecture,
      new Coordination(this.storage),
      this.storage,
    );
    const session = await execution.admit(
      { directory: this.root, goal: 'Exact goal café 🛠\nSecond line' },
      new AbortController().signal,
    );
    assert(session instanceof HostTask, JSON.stringify(session));
    this.sessions.push(session);
    t.mock.method(GitHub.prototype, 'publication', async () => undefined);
    t.mock.method(GitHub.prototype, 'remoteHead', async () => undefined);
    await execution.prepare(session, '42', new AbortController().signal);
    assert.equal(this.git('branch', '--list', '--format=%(refname:short)', '42-task'), '42-task');
    return session;
  }

  /** Write explicit fixture records before their committed capture is taken. */
  write(path: string, value: unknown) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), typeof value === 'string' ? value : stringify(value));
  }

  /** Bind the controlled compiled executable without changing captured source. */
  private installProbe() {
    const executable = join(this.root, '.git', 'inspection-provider.mjs');
    const source = readFileSync(
      fileURLToPath(new URL('./inspection-provider.js', import.meta.url)),
      'utf8',
    );
    writeFileSync(executable, source.replace(/^#![^\n]*/, '#!' + process.execPath), {
      mode: 0o700,
    });
    this.write('.git/bindings.yaml', { schemaVersion: 1, tools: { codex: executable } });
  }

  /** Retain real actor identities while making activity leakage and web coupling observable. */
  private configureActors() {
    for (const id of ['direction', 'work', 'reviewer']) {
      const path = catalog + '/components/' + id + '.yaml';
      const component = parse(readFileSync(join(this.root, path), 'utf8'));
      if (id === 'work') component.owns.push('AGENTS.md', '.agents');
      component.activities = activityDefinitions(id);
      this.write(path, component);
    }
    this.write(catalog + '/execution-profiles/web.yaml', {
      id: 'web',
      model: 'explicit-web',
      reasoning: 'high',
      webSearch: 'live',
      operationCategories: ['read'],
    });
    const path = catalog + '/execution-profiles/direction.yaml';
    const profile = parse(readFileSync(join(this.root, path), 'utf8'));
    this.write(path, { ...profile, webSearch: 'cached' });
  }
}

/** Declare disjoint public activity bindings without deriving them from implementation state. */
function activityDefinitions(id: string) {
  const names =
    id === 'work'
      ? ['testing', 'documentation', 'empty', 'empty-web']
      : [id === 'direction' ? 'planning' : 'review'];
  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        role: 'assessor',
        profile: name === 'empty-web' ? 'web' : id,
        instructions: ['Selected ' + id + '/' + name + ' procedure café 🛠'],
        operations: name.startsWith('empty')
          ? []
          : name === 'documentation'
            ? ['inspect-list']
            : id === 'work'
              ? ['inspect-read', 'owned-edit']
              : ['inspect-read'],
        standards: [],
      },
    ]),
  );
}
