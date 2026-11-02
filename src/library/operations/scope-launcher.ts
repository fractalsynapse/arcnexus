import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// This host-owned entry point joins before launching any candidate-controlled code.
const [scope, command, ...args] = process.argv.slice(2);

if (!scope || !command) throw new Error('Captured process scope and command required');

writeFileSync(join(scope, 'cgroup.procs'), String(process.pid));

const child = spawn(command, args, { stdio: 'inherit' });

child.once('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.once('exit', (code) => process.exit(code ?? 1));
