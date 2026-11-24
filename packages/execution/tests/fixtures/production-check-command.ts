import { readFileSync, writeFileSync } from 'node:fs';

const phase = process.argv[2];
const baseline = readFileSync('../baseline', 'utf8');
writeFileSync('overlay.txt', 'Disposable command write\n');
process.stdout.write(JSON.stringify({ phase, baseline, cwd: process.cwd() }) + '\n');
if (phase === 'failure') {
  process.stderr.write('Declared command failure\n  complete café detail\n');
  process.exitCode = 37;
}
