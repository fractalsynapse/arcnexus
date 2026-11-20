import { readFileSync } from 'node:fs';

/** Exercise an actual command whose success depends on the secured correction. */
function main() {
  const input = readFileSync('fixture.txt', 'utf8');
  if (input === 'corrected') return;
  console.error('Error: reviewed behavior still fails');
  process.exitCode = 37;
}

main();
