import { existsSync, readFileSync } from 'node:fs';

/** Exercise a real command and independently observable external prerequisite. */
function main() {
  const schema = process.argv[3];
  if (schema && !existsSync(schema)) {
    console.error(
      'External schema unavailable. Supply the approved external schema before correction.',
    );
    process.exitCode = 43;
    return;
  }
  const input = readFileSync('fixture.txt', 'utf8');
  if (input === 'corrected') return;
  const diagnostic = process.argv[4];
  console.error(
    diagnostic && existsSync(diagnostic)
      ? readFileSync(diagnostic, 'utf8')
      : diagnostic || 'Error: reviewed behavior still fails',
  );
  process.exitCode = 37;
}

main();
