import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { GeneralFixture } from '../../testing/support/general-fixture.js';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import { Publisher } from '../../../../dist/library/publisher/publisher.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { save, type RecordData } from '../../../../dist/library/workspace/state.js';
import { candidateDigest } from '../../../../dist/library/change-inspection/changes.js';
import { git } from '../../../../dist/library/operations/process.js';

/** Supplies recorded source proof while target operations, Git and verification use production services. */
export class PublicationFixture {
  readonly general: GeneralFixture;

  readonly context;

  readonly host: ProjectHost;

  readonly deliveries: DeliveryStore;

  readonly source;

  readonly record: RecordData;

  readonly assignment;

  readonly delivery;

  /** Creates a clean target and explicitly controlled simulated source evidence without executing a fake campaign. */
  constructor(t: TestContext) {
    this.general = new GeneralFixture(t);
    this.policy();
    const f = this.general.fixture;
    this.context = new ExecutionContext().resolve(f.repo);
    this.host = new ProjectHost(f.state, this.context);
    this.deliveries = new DeliveryStore(
      join(f.state, 'projects', this.context.key, 'deliveries.sqlite'),
    );
    t.after(() => {
      this.deliveries.close();
      this.host.close();
    });
    this.source = this.host.submit('Preserve the reviewed source improvement', true);
    this.assignment = this.host.store.enqueue(this.source.id, 'a', 'Improve source', [
      'Updated source',
    ]);
    this.record = this.candidate();
    this.delivery = this.capture();
  }

  /** Defines actual finite verification plus explicit collaboration/publication grants in captured source. */
  private policy(): void {
    const f = this.general.fixture;
    this.operations();
    const environment = join(f.repo, 'architecture/environment.yaml');
    const value = JSON.parse(readFileSync(environment, 'utf8'));
    value.workspace.primary.repository = 'https://github.com/example/publication-fixture.git';
    writeFileSync(environment, JSON.stringify(value));
    f.git('remote', 'set-url', 'origin', value.workspace.primary.repository);
    f.commit();
    const path = join(f.repo, 'architecture/components/a.json');
    const owner = JSON.parse(readFileSync(path, 'utf8'));
    owner.operations = { tracking: ['agent'], publish: ['agent'] };
    writeFileSync(path, JSON.stringify(owner));
    f.commit();
  }

  /** Defines distinct shared upstream actions; model fixtures cannot invent operation authority. */
  private operations(): void {
    const f = this.general.fixture;
    for (const [id, action] of [
      ['tracking', 'issue.create'],
      ['publish', 'delivery.publish'],
    ])
      writeFileSync(
        join(f.repo, `architecture/operations/${id}.yaml`),
        JSON.stringify({
          schemaVersion: 4,
          id,
          action,
          kind: 'upstream',
          purpose: 'Controlled target lifecycle',
          repository: 'sample',
          cwd: '.',
          category: 'cli-check',
          generatedDirectories: [],
          artifacts: [],
          ...(id === 'publish' ? { targetBranch: 'staging' } : {}),
        }),
      );
  }

  /** Creates real isolated Git changes; source review content below remains visibly deterministic input. */
  private candidate(): RecordData {
    const f = this.general.fixture;
    const simulation = join(f.root, 'simulation');
    git(f.root, 'clone', '--no-hardlinks', '--quiet', f.repo, simulation);
    writeFileSync(join(simulation, 'source.txt'), 'reviewed improvement');
    const record: RecordData = {
      id: randomUUID(),
      source: simulation,
      workspace: simulation,
      base: this.context.base,
      commonDir: join(simulation, '.git'),
      branch: '',
      status: 'completed',
      startedAt: 'controlled fixture',
      commands: [],
      environment: { schemaVersion: 4, prerequisites: [], setup: [], generatedDirectories: [] },
      executionRunId: this.source.id,
      executionEnvironment: this.source.environment,
      assignmentId: this.assignment.id,
    };
    mkdirSync(join(f.state, 'runs', record.id), { recursive: true });
    save(f.state, record);
    return record;
  }

  /** Captures original reviewed provenance through the production publisher and leaves the target untouched. */
  private capture() {
    const f = this.general.fixture;
    const candidate = new CandidateSnapshots(
      this.record.source,
      join(f.state, 'snapshots'),
    ).capture(this.record.workspace, this.record.base);
    this.host.store.updateAssignment(this.assignment.id, 'ready', { recordId: this.record.id });
    this.host.store.complete(this.assignment.id, [this.review('verifier')], {
      candidateRevision: candidate,
      candidateRecord: this.record,
    });
    (this.record as Record<string, unknown>).verdict = {
      key: 'fixture-inputs',
      digest: candidateDigest(this.record),
      independent: true,
      result: {
        status: 'passed',
        evidence: [join(f.state, 'runs', this.record.id, 'report.json')],
        artifacts: [],
      },
    };
    this.host.store.updateRun(this.source.id, 'completed', {});
    return new Publisher(f.state, this.deliveries).capture(
      this.context.key,
      this.host.store.run(this.source.id),
      [this.host.store.assignment(this.assignment.id)],
      { repository: 'example/publication-fixture', branch: 'staging' },
    );
  }

  /** Supplies immutable recorded source assessments only at the explicit acceptance model boundary. */
  private review(role: string): string {
    const id = randomUUID();
    const path = join(this.general.fixture.state, 'runs', id);
    mkdirSync(path, { recursive: true });
    writeFileSync(
      join(path, 'report.json'),
      JSON.stringify({
        id,
        parentRecordId: this.record.id,
        executionRunId: this.source.id,
        assignmentId: this.assignment.id,
        activationRole: role,
        status: 'completed',
        executionEnvironment: this.source.environment,
        acceptanceCriteria: ['Updated source'],
        verificationEvidence: {
          candidateDigest: candidateDigest(this.record),
          baseline: this.record.base,
        },
        agent: this.assessment(),
      }),
    );
    return join(path, 'report.json');
  }

  /** Labels source review as controlled input, separate from new target verifier activations. */
  private assessment() {
    return {
      status: 'completed',
      summary: 'Recorded source acceptance',
      deficiencies: [],
      criteria: [
        {
          index: 0,
          verdict: 'verified',
          evidence: ['Controlled source observation'],
          explanation: 'Fixture',
        },
      ],
    };
  }

  /** Installs a fixture-only host credential and restores the caller environment after the scenario. */
  credential(t: TestContext): void {
    const old = process.env.GH_TOKEN;
    process.env.GH_TOKEN = 'controlled-test-credential';
    t.after(() => {
      if (old === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = old;
    });
  }

  /** Replaces only the real provider transport; any unexpected network operation fails the scenario. */
  tracking(t: TestContext): string[] {
    const calls: string[] = [];
    this.credential(t);
    t.mock.method(globalThis, 'fetch', async (url: string | URL, options: RequestInit) => {
      if (
        String(url) !== 'https://api.github.com/repos/example/publication-fixture/issues' ||
        options.method !== 'POST'
      )
        throw new Error('Unexpected provider operation in publication acceptance');
      calls.push(String(options.body));
      return new Response(
        JSON.stringify({
          id: 1,
          number: 1,
          html_url: 'https://github.com/example/publication-fixture/issues/1',
        }),
      );
    });
    return calls;
  }
}
