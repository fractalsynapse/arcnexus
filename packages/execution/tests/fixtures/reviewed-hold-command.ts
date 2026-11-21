import { existsSync, readFileSync } from 'node:fs';

/** Execute a deterministic diagnostic using actual committed project inputs. */
function main() {
  const external = process.argv[2] === 'external';
  if (external && !existsSync('schema.txt')) {
    console.error(
      'External prerequisite unavailable: schema.txt\nRequired action: supply the approved schema.',
    );
    process.exitCode = 43;
    return;
  }
  const input = readFileSync(process.argv[4] ?? 'fixture.txt', 'utf8');
  console.error(
    process.argv[3] === 'stable'
      ? 'Error: reviewed behavior still fails'
      : 'Error: rejected criterion still fails\nRelevant input: ' + input,
  );
  process.exitCode = 37;
}

main();
