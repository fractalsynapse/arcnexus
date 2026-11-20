import { spawnSync } from 'node:child_process';
import { TestSelection, testInventory } from '../src/index.js';

const selection = new TestSelection(process.argv.slice(2));
const { owner } = selection;
const suites = testInventory(owner, selection);

console.log(`Running ${suites.length} test suite(s)${owner ? ` for ${owner}` : ''}`);
for (const { file, owner, level } of suites) console.log(`  ${owner} ${level} ${file}`);

const result = spawnSync(process.execPath, ['--test', ...suites.map(({ file }) => file)], {
  stdio: 'inherit',
  env: selection.environment(),
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
