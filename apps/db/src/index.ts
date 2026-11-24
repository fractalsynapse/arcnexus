import type { Context } from 'cordis';
import type { Client } from 'pg';
import { capacityMigration } from '../../../packages/capacity/src/index.js';
import { catalogMigration } from '../../../packages/catalog/src/index.js';
import {
  coordinationMigration,
  importSqliteJournal,
  cutoverSqliteJournal,
  hostedCoordinationMigration,
  hostSessionMigration,
  workflowRequestsMigration,
  workflowReceiptsMigration,
  workflowRuntimeMigration,
  journalNotificationMigration,
} from '../../../packages/coordination/src/index.js';
import { migrate, verifyMigrations } from './migrations.js';

const modelMigrations = [
  coordinationMigration,
  journalNotificationMigration,
  hostedCoordinationMigration,
  hostSessionMigration,
  workflowRequestsMigration,
  workflowReceiptsMigration,
  workflowRuntimeMigration,
  capacityMigration,
  catalogMigration,
];

/** Refuse runtime schema mismatches before admitting requests. */
export function verifyPlatformDatabase(database: Client) {
  return verifyMigrations(database, modelMigrations);
}

declare module 'cordis' {
  interface Context {
    databaseSetup: {
      migrate(): Promise<void>;
      cutover(storage: string, remote: string): ReturnType<typeof cutoverSqliteJournal>;
      rehearseImport(storage: string, remote: string): ReturnType<typeof importSqliteJournal>;
    };
  }
}

export function databaseSetupPlugin(database: Client) {
  return {
    /** Compose owner migrations and rehearsal operations through the DB entry. */
    apply(context: Context) {
      context.provide('databaseSetup', {
        migrate: () => migrate(database, modelMigrations),
        cutover: (storage: string, remote: string) =>
          cutoverSqliteJournal(database, storage, remote),
        rehearseImport: (storage: string, remote: string) =>
          importSqliteJournal(database, storage, remote),
      });
    },
  };
}
