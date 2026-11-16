import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { testInventory } from './test-inventory.js';

const [owner, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0, 'Usage: npm test [owner]');
const suites = testInventory(owner);

console.log(`Running ${suites.length} test suite(s)${owner ? ` for ${owner}` : ''}`);
for (const { file, owner, level } of suites) console.log(`  ${owner} ${level} ${file}`);

const result = spawnSync(process.execPath, ['--test', ...suites.map(({ file }) => file)], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
