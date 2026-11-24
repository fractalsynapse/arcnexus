import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation } from '../../data/src/index.js';
import { Catalog, type VerifyRepository } from './catalog.js';
import { importSchema, projectSchema } from './schema.js';

export { catalogMigration, importSchema, projectSchema } from './schema.js';
export type { VerifyRepository } from './catalog.js';

declare module 'cordis' {
  interface Context {
    catalog: Catalog;
  }
}

export function catalogPlugin(database: Client, verify: VerifyRepository) {
  return {
    /** Publish the catalog owner service. */
    apply(context: Context) {
      context.provide('catalog', new Catalog(database, verify));
    },
  };
}

export const catalogDataPlugin = {
  inject: ['data', 'catalog'],
  /** Publish platform-scoped catalog resource operations and their schemas. */
  apply(context: Context) {
    const catalog = context.catalog;
    context.effect(() =>
      context.data.register({
        id: 'projects',
        operations: {
          list: dataOperation(z.strictObject({}), z.array(projectSchema), (scope) =>
            catalog.list(scope.principal),
          ),
          create: dataOperation(importSchema, projectSchema, (scope, repository) =>
            catalog.add(scope.principal, repository),
          ),
          delete: dataOperation(z.strictObject({ id: z.uuid() }), projectSchema, (scope, { id }) =>
            catalog.remove(scope.principal, id),
          ),
        },
      }),
    );
  },
};
