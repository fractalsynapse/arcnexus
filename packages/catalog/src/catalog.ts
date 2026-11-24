import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { z } from 'zod';
import { importSchema, type projectSchema, revisionSchema } from './schema.js';

type Project = z.output<typeof projectSchema>;
export type ImportProject = z.output<typeof importSchema>;
export type VerifyRepository = (repository: ImportProject, operator: string) => Promise<string>;

/** Preserve verified project identities independently of their selection lifecycle. */
export class Catalog {
  /** Run provider verification before recording a new binding. */
  constructor(
    private readonly database: Client,
    private readonly verify: VerifyRepository,
  ) {}

  /** Return the projects the operator can currently select. */
  async list(operator: string) {
    const { rows } = await this.database.query<Project>(
      'SELECT id, remote, revision FROM arcnexus_catalog.projects WHERE operator = $1 AND NOT retired ORDER BY remote',
      [operator],
    );
    return rows;
  }

  /** Resolve restricted binding metadata without exposing credentials or retired projects. */
  async resolve(operator: string, id: string) {
    const { rows } = await this.database.query<Project>(
      'SELECT id, remote, revision FROM arcnexus_catalog.projects WHERE operator = $1 AND id = $2 AND NOT retired',
      [operator, id],
    );
    return rows[0];
  }

  /** Verify repository access, then create or restore its selection record. */
  async add(operator: string, input: ImportProject) {
    const repository = importSchema.parse(input);
    const revision = revisionSchema.parse(await this.verify(repository, operator));
    const { rows } = await this.database.query<Project>(
      `INSERT INTO arcnexus_catalog.projects (id, operator, remote, credential, revision)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (operator, remote) DO UPDATE SET retired = false,
          revision = EXCLUDED.revision, credential = EXCLUDED.credential
       RETURNING id, remote, revision`,
      [randomUUID(), operator, repository.remote, repository.credential ?? null, revision],
    );
    return rows[0]!;
  }

  /** Retire the selection and preserve the project identifier and evidence correlation. */
  async remove(operator: string, id: string) {
    const { rows } = await this.database.query<Project>(
      `UPDATE arcnexus_catalog.projects SET retired = true
       WHERE operator = $1 AND id = $2 AND NOT retired RETURNING id, remote, revision`,
      [operator, id],
    );
    if (!rows[0]) throw new Error('Project unavailable');
    return rows[0];
  }
}
