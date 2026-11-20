import { existsSync, readFileSync } from 'node:fs';

/** Execute a deterministic diagnostic using actual committed project inputs. */
function main() {
  const external = process.argv[2] === 'external';
  if (external && !existsSync('schema.txt')) {
    console.error('External prerequisite unavailable: schema.txt\nRequired action: supply the approved schema.');
    process.exitCode = 43;
    return;
  }
  const input = readFileSync('fixture.txt', 'utf8');
  console.error('Error: rejected criterion still fails\nRelevant input: ' + input);
  process.exitCode = 37;
}

main();
