import { statePath } from '../workspace/state.js';
import { ContainerLifetime } from './container-lifetime.js';

const lifetime = new ContainerLifetime(statePath());

// The lifetime service owns no work queue; ordinary CLI requests create the project hosts.
const keepAlive = setInterval(() => {}, 60_000);

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void lifetime.shutdown().then(
      () => {
        clearInterval(keepAlive);
        process.exitCode = 0;
      },
      (error) => {
        console.error(error);
        clearInterval(keepAlive);
        process.exitCode = 1;
      },
    );
  });

console.log(JSON.stringify({ status: 'ready', service: 'container-lifetime' }));
