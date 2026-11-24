import { Context } from 'cordis';
import { Client } from 'pg';
import { Architecture } from '../../../packages/architecture/src/index.js';
import { databaseSetupPlugin } from './index.js';

const [command, project, storage] = process.argv.slice(2);
const connectionString = process.env.ARC_DATABASE_URL;
if (!connectionString) throw new Error('ARC_DATABASE_URL is required');
const database = new Client({ connectionString });
await database.connect();
try {
  const context = new Context();
  await context.use(databaseSetupPlugin(database));
  if (command === 'migrate' && process.argv.length === 3) {
    await context.databaseSetup.migrate();
    console.log('Database migrations verified');
  } else if (command === 'rehearse-import' && project && storage && process.argv.length === 5) {
    const { source } = new Architecture().capture(project);
    console.log(JSON.stringify(await context.databaseSetup.rehearseImport(storage, source.remote)));
  } else {
    throw new Error(
      'Use migrate or rehearse-import <verified-project-directory> <journal-storage>',
    );
  }
} finally {
  await database.end();
}
