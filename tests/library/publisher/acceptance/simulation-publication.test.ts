import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { SimulationPublication } from '../../../../dist/library/publisher/publisher.js';
import type { CapturedPublicationPolicy } from '../../../../dist/library/publisher/publisher.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

/** Exercises complete provider orchestration with actual Git and controlled check-boundary inputs. */
class PublicationFixture {
  readonly git: GitDeliveryFixture;

  readonly publication: SimulationPublication;

  checks = 0;

  readonly policy: CapturedPublicationPolicy = {
    owner: 'publisher',
    operation: {
      schemaVersion: 4,
      id: 'publish',
      kind: 'upstream',
      action: 'delivery.publish',
      purpose: 'Controlled publication authority',
      repository: 'repo',
      cwd: '.',
      category: 'collaboration',
      activities: ['release'],
      generatedDirectories: [],
      artifacts: [],
      probes: [],
      targetBranch: 'staging',
      definitionDigest: 'policy',
    },
  };

  /** Uses production effect and publication wiring while keeping synthetic verification explicitly in acceptance. */
  constructor(t: TestContext) {
    this.git = new GitDeliveryFixture(t);
    const path = join(this.git.root, 'built-output');
    writeFileSync(path, 'controlled artifact');
    const sha256 = createHash('sha256').update('controlled artifact').digest('hex');
    this.publication = new SimulationPublication(
      {
        root: this.git.root,
        repositoryId: 'repo',
        repository: this.git.repository,
        effects: this.git.effects,
        deliveries: this.git.store,
        policy: this.policy,
        checks: async () => {
          this.checks++;
          return {
            status: 'passed',
            evidence: ['controlled-check'],
            artifacts: [{ path, sha256 }],
          };
        },
      },
      this.git.store.get(this.git.id),
    );
    t.after(() => this.publication.close());
  }
}

test('publication retains pending PR until revision approval then completes and reuses every receipt', async (t) => {
  const f = new PublicationFixture(t);
  await assert.rejects(() => f.publication.publish(f.git.signal), /requires approval/);
  const pending = f.git.store.get(f.git.id);
  assert.equal(pending.delivery, 'pushed');
  assert.equal(pending.integration, 'pending');
  assert.equal(f.git.provider.targetHead(), f.git.repository.base);
  f.git.store.approve(pending.id, pending.version, pending.candidate);
  const released = await f.publication.publish(f.git.signal);
  assert.equal(released.integration, 'merged');
  assert.equal(released.publication, 'released');
  assert.equal(f.checks, 2);
  assert.deepEqual(await f.publication.publish(f.git.signal), released);
  assert.equal(f.checks, 2);
  assert.equal(f.git.effects.effects().length, 7);
});

registerSuite({
  component: 'publisher',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
