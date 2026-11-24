import { mock } from 'node:test';
import { RecoveryScenario } from './checkpoint.js';

// Controlled actor and Collaboration ports; real child process, Git, SQLite and checked edits.
const scenario = new RecoveryScenario({ mock, after() {} }, true, false, false, {
  directory: process.argv[2]!,
  abrupt: true,
});
await scenario.run();
throw new Error('The child returned without crossing the acknowledged-edit crash boundary');
