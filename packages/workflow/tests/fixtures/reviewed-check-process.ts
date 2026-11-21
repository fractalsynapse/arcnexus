import childProcess, { type SpawnOptions } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import type { TestContext } from 'node:test';

/**
 * Control only nested confinement launch while production check/result/journal code executes.
 * The declared command still runs as a real subprocess in the outer Testing sandbox.
 * This fixture establishes result-shape recovery, not native Bubblewrap confinement.
 */
export function controlledCheckLaunch(t: TestContext) {
  const spawn = childProcess.spawn;
  const mocked = t.mock.method(
    childProcess,
    'spawn',
    (command: string, args: string[], options: SpawnOptions) => {
      if (command !== '/usr/bin/bwrap') return spawn(command, args, options);
      const separator = args.indexOf('--');
      if (separator < 0) throw new Error('Expected a declared confined check command');
      return spawn(args[separator + 1]!, args.slice(separator + 2), options);
    },
  );
  syncBuiltinESMExports();
  t.after(() => {
    mocked.mock.restore();
    syncBuiltinESMExports();
  });
}
