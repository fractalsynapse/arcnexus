import { z } from 'zod';

const github = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/;

export const remoteSchema = z
  .string()
  .refine(
    (value) => github.test(value) && !value.split('/').at(-1)?.startsWith('.'),
    'Expected a canonical HTTPS GitHub repository',
  )
  .transform((value) => value.replace(/\.git$/, '').toLowerCase() + '.git');

export const importSchema = z.strictObject({
  remote: remoteSchema,
  credential: z.string().trim().min(1).optional(),
});

export const revisionSchema = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);

export const projectSchema = z.strictObject({
  id: z.uuid(),
  remote: z.string(),
  revision: revisionSchema,
});

export const catalogMigration = {
  id: 'catalog/projects',
  sql: `
    CREATE SCHEMA arcnexus_catalog;
    CREATE TABLE arcnexus_catalog.projects (
      id uuid PRIMARY KEY, operator text NOT NULL, remote text NOT NULL,
      credential text, revision text NOT NULL, retired boolean NOT NULL DEFAULT false,
      UNIQUE (operator, remote)
    );
  `,
};
