import { Context } from 'cordis';
import { connectDatabase } from '../../../packages/platform/src/index.js';
import { Architecture } from '../../../packages/architecture/src/index.js';
import { configureRuntimeRoles } from './runtime-roles.js';
import { databaseSetupPlugin, verifyPlatformDatabase } from './index.js';

import { databaseArchives } from './archive.js';

const [command, project, storage] = process.argv.slice(2);
if (command === 'backup' || command === 'restore') {
  await archiveCommand(command, project, storage);
} else {
  await projectDatabase();
}

async function projectDatabase() {
  const database = await connectDatabase();
  try {
    const context = new Context();
    await context.use(databaseSetupPlugin(database));
    if (command === 'migrate' && process.argv.length === 3) {
      await context.databaseSetup.migrate();
      await configureRuntimeRoles(database);
      console.log('Database migrations verified');
    } else if (project && storage && process.argv.length === 5) {
      const { source } = new Architecture().capture(project);
      console.log(
        JSON.stringify(
          await projectCommand(context.databaseSetup, command, storage, source.remote),
        ),
      );
    } else
      throw new Error(
        'Use migrate, rehearse-import <project> <storage>, or cutover <project> <storage>',
      );
  } finally {
    await database.end();
  }
}

async function archiveCommand(command: 'backup' | 'restore', location?: string, snapshot?: string) {
  const database = process.env.PGDATABASE;
  if (
    process.env.ARC_ISOLATED_REVIEW !== '1' ||
    !database ||
    !location ||
    !snapshot ||
    process.argv.length !== 5
  )
    throw new Error(
      'Use backup or restore <archive-directory> <host-snapshot-id> in an isolated review with PGDATABASE',
    );
  console.log(
    JSON.stringify(
      await databaseArchives(verifyPlatformDatabase)[command](database, location, snapshot),
    ),
  );
}

async function projectCommand(
  setup: Context['databaseSetup'],
  command: string | undefined,
  storage: string,
  remote: string,
) {
  if (command === 'rehearse-import') return setup.rehearseImport(storage, remote);
  if (command === 'cutover' && process.env.ARC_ISOLATED_REVIEW === '1')
    return setup.cutover(storage, remote);
  throw new Error('Database project operation unavailable');
}
