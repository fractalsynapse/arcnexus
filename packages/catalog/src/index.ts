import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation } from '../../data/src/index.js';
import { Catalog, type VerifyRepository } from './catalog.js';
import { importSchema, projectSchema, revisionSchema } from './schema.js';

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
    const operations = { ...catalogReads(catalog), ...catalogWrites(catalog) };
    context.effect(() => context.data.register({ id: 'projects', operations }));
  },
};

const id = z.strictObject({ id: z.uuid() });
const reachability = z.discriminatedUnion('reachable', [
  z.strictObject({ reachable: z.literal(true), revision: revisionSchema }),
  z.strictObject({ reachable: z.literal(false), diagnostic: z.string() }),
]);

function catalogReads(catalog: Catalog) {
  return {
    probe: dataOperation(id, reachability, (scope, input) =>
      catalog.probe(scope.principal, input.id),
    ),
    list: dataOperation(
      z.strictObject({}),
      z.strictObject({ entries: z.array(projectSchema) }),
      async (scope) => ({
        entries: await catalog.list(scope.principal),
      }),
    ),
    read: dataOperation(id, projectSchema, async (scope, { id }) => {
      const project = await catalog.resolve(scope.principal, id);
      if (!project) throw new Error('Project unavailable');
      return project;
    }),
  };
}

function catalogWrites(catalog: Catalog) {
  return {
    update: dataOperation(
      id.extend({ expectedRevision: revisionSchema }),
      projectSchema,
      (scope, { id, expectedRevision }) => catalog.refresh(scope.principal, id, expectedRevision),
    ),
    create: dataOperation(importSchema, projectSchema, (scope, repository) =>
      catalog.add(scope.principal, repository),
    ),
    delete: dataOperation(id, projectSchema, (scope, { id }) =>
      catalog.remove(scope.principal, id),
    ),
  };
}
