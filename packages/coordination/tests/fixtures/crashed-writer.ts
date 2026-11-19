import assert from 'node:assert/strict';
import { Coordination, Journal } from '../../src/index.js';

/** Leave a committed nested writer stack behind a genuine abrupt process exit. */
class CrashedWriter {
  /** Persist complete answers and checkpoint identities before killing this fixture process. */
  static run() {
    const [directory, remote] = process.argv.slice(2);
    assert(directory && remote);
    const root = new Coordination(directory).admit(remote, 'Foreground refinement');
    assert(root instanceof Journal);
    const phase = root.child('Architect', 'round:1:architect');
    assert(phase instanceof Journal);
    const task = phase.child('Prerequisite', 'implementation');
    assert(task instanceof Journal);
    task.record({ answer: 'Complete retained answer', checkpoint: 'secured-head', issue: '10' });
    process.kill(process.pid, 'SIGKILL');
  }
}

CrashedWriter.run();
