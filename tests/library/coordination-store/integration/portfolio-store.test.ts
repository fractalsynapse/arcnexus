import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { PortfolioStore } from '../../../../dist/library/coordination-store/portfolio-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Retains an actual preceding registry database across read-only access and writable upgrade. */
class LegacyPortfolioFixture {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-portfolio-store-'));

  readonly path = join(this.directory, 'portfolio.sqlite');

  readonly repository = { id: 'retained', location: '/retained/source', managed: false };

  readonly registration = {
    id: 'platform',
    kind: 'platform',
    repositoryId: 'retained',
    definitionId: 'platform',
    revision: 3,
    active: true,
  };

  /** Creates the original schema independently of the product's current initializer. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.directory, { recursive: true, force: true }));
    const db = new DatabaseSync(this.path);
    try {
      db.exec(`CREATE TABLE repositories(id TEXT PRIMARY KEY,data TEXT NOT NULL);
        CREATE TABLE registrations(kind TEXT,id TEXT,data TEXT,PRIMARY KEY(kind,id));
        CREATE TABLE events(sequence INTEGER PRIMARY KEY,type TEXT,data TEXT);
        PRAGMA user_version=1;`);
      db.prepare('INSERT INTO repositories VALUES(?,?)').run(
        this.repository.id,
        JSON.stringify(this.repository),
      );
      db.prepare('INSERT INTO registrations VALUES(?,?,?)').run(
        'platform',
        'platform',
        JSON.stringify(this.registration),
      );
    } finally {
      db.close();
    }
  }

  /** Inspects the on-disk version without invoking product migration. */
  version(): number {
    const db = new DatabaseSync(this.path, { readOnly: true });
    try {
      return Number(db.prepare('PRAGMA user_version').get()!.user_version);
    } finally {
      db.close();
    }
  }
}

test('read-only portfolio access preserves the original registry schema and locations', (t) => {
  const f = new LegacyPortfolioFixture(t);
  const store = new PortfolioStore(f.path);
  try {
    assert.deepEqual(store.repositories(), [f.repository]);
    assert.deepEqual(store.registrations(), [f.registration]);
    assert.deepEqual(store.materializations(), []);
    assert.equal(f.version(), 1);
  } finally {
    store.close();
  }
});

test('writable portfolio upgrade retains registrations and accepts void checkpoint transitions', (t) => {
  const f = new LegacyPortfolioFixture(t);
  const store = new PortfolioStore(f.path, true);
  try {
    store.transaction('checkpoint', () => {
      store.materialization({
        id: 'clone',
        remote: 'file:///source',
        location: 'repositories/clone/source',
        evidence: 'repositories/clone/evidence',
        status: 'pending',
      });
    });
    assert.deepEqual(store.repositories(), [f.repository]);
    assert.deepEqual(store.registrations(), [f.registration]);
    assert.equal(store.materializations()[0]!.id, 'clone');
    assert.equal(f.version(), 2);
  } finally {
    store.close();
  }
});

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic'] });
