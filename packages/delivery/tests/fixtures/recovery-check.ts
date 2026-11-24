import { readFileSync } from 'node:fs';

const baseline = readFileSync('baseline', 'utf8');
process.stdout.write(
  JSON.stringify({
    phase: process.argv[2],
    cwd: process.cwd(),
    checked: readFileSync('checked.txt', 'utf8'),
    baseline,
  }) + '\n',
);
if (baseline !== 'durable evidence\n') {
  process.stderr.write('Recovered required command rejected baseline:\n' + baseline);
  process.exitCode = 1;
}
