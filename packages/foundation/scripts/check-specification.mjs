import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path/posix';
import { parse } from 'yaml';

const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const root = '.arc/architecture';
const read = (path) => readFileSync(path, 'utf8');
const yaml = (path) => parse(read(path));
const project = yaml(join(root, 'project.yaml'));

/** Index the tracked definitions by their authored IDs. */
function catalog(kind) {
  const prefix = join(root, kind) + '/';
  const entries = paths
    .filter((path) => path.startsWith(prefix) && path.endsWith('.yaml'))
    .map((path) => [path, yaml(path)]);
  const index = new Map(entries.map(([, entry]) => [entry.id, entry]));
  assert.equal(index.size, entries.length, `Duplicate ${kind} ID`);
  for (const [path, entry] of entries) assert.equal(path, prefix + entry.id + '.yaml');
  return index;
}

/** Match a tracked path to the declared owner roots. */
function ownersFor(path, components) {
  return [...components.values()].filter(({ owns }) =>
    owns.some((root) => path === root || path.startsWith(root + '/')),
  );
}

/** Verify that component activities and task actor bindings have complete references. */
function checkActivities(components) {
  const roles = catalog('roles');
  const profiles = catalog('execution-profiles');
  const operations = catalog('operations');
  const standards = catalog('standards');
  for (const { id, activities } of components.values()) {
    assert(Object.keys(activities).length, `${id} declares no activities`);
    for (const [name, entry] of Object.entries(activities)) {
      const scope = `${id}/${name}`;
      assert(roles.has(entry.role), `${scope}: unknown role ${entry.role}`);
      assert(entry.instructions?.length, `${scope}: missing instructions`);
      assert(
        Array.isArray(entry.operations) && entry.operations.every((op) => operations.has(op)),
        `${scope}: missing or unknown operations`,
      );
      assert(
        Array.isArray(entry.standards) && entry.standards.every((rule) => standards.has(rule)),
        `${scope}: missing or unknown standards`,
      );
      if (entry.executor === 'host') assert.equal(entry.profile, undefined, scope);
      else assert(profiles.has(entry.profile), `${scope}: unknown profile ${entry.profile}`);
    }
  }
  for (const { component, activity } of [project.director, project.verifier]) {
    assert(
      components.get(component)?.activities[activity],
      `Unknown binding: ${component}/${activity}`,
    );
  }
}

/** Verify contract bytes, ownership, unique scenario IDs, and dependency references. */
function checkContracts(components) {
  const { contracts } = yaml(project.contractRegistry);
  const ids = new Set(contracts.map(({ id }) => id));
  assert.equal(ids.size, contracts.length, 'Duplicate contract ID');
  const scenarios = new Set();
  for (const item of contracts) {
    const body = readFileSync(item.file);
    const ownerIDs = ownersFor(item.file, components).map(({ id }) => id);
    assert.deepEqual(ownerIDs, [item.owner], `Contract owner: ${item.file}`);
    assert.equal(
      createHash('sha256').update(body).digest('hex'),
      item.digest,
      `Contract digest: ${item.file}`,
    );
    assert(
      item.dependsOn.every((id) => ids.has(id)),
      `Unknown dependency: ${item.id}`,
    );
    if (item.stage === 'locked')
      assert(item.acceptedBy && item.acceptedAt, `Missing acceptance: ${item.id}`);
    const rows = [...body.toString().matchAll(/^\| ([A-Z]+-\d+[a-z]?) \|/gm)];
    assert.equal(rows.length, item.scenarios, `Scenario count: ${item.id}`);
    for (const [, id] of rows) {
      assert(!scenarios.has(id), `Duplicate acceptance scenario: ${id}`);
      scenarios.add(id);
    }
  }
}

/** Verify tracked Markdown link targets and skill front matter. */
function checkMarkdown(path) {
  const contents = read(path);
  if (path.endsWith('/SKILL.md')) {
    const metadata = parse(contents.split('---', 3)[1]);
    assert.equal(metadata?.name, dirname(path).split('/').at(-1), `Skill name: ${path}`);
    assert(metadata.description, `Skill description: ${path}`);
  }
  for (const [, target] of contents.matchAll(/(?<!!)\[[^\]\n]+\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    if (/^[\w+.-]+:/.test(target)) continue;
    assert(existsSync(join(dirname(path), target)), `Missing link target: ${path} → ${target}`);
  }
}

const components = catalog('components');
for (const path of paths) {
  assert.equal(ownersFor(path, components).length, 1, `Expected one owner: ${path}`);
  if (path.endsWith('.md')) checkMarkdown(path);
}
checkActivities(components);
checkContracts(components);

const hasExecutableSources = paths.some((path) =>
  /^(?:src\/|tests\/|(?:apps|packages)\/[^/]+\/(?:src|tests)\/).+\.[cm]?[jt]sx?$/.test(path),
);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `executable=${hasExecutableSources}\n`);
}
console.log('Specification checks passed: ownership, activities, contracts, links and skills.');
if (!hasExecutableSources)
  console.log(
    'Product checks are inapplicable: this revision has no tracked product source or tests.',
  );
