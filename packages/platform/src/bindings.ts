import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { z } from 'zod';
import { Architecture } from '../../architecture/src/index.js';
import { verifyBoundCommit } from '../../collaboration/src/index.js';
import { readSecret } from './database.js';
import { importSchema } from '../../catalog/src/index.js';

const configuration = z.strictObject({
  operator: z.string().min(1),
  projects: z.array(
    z.strictObject({
      directory: z.string().min(1),
      remote: importSchema.shape.remote,
      hosted: z.boolean().optional(),
      provider: z.uuid().optional(),
      evidence: z.string().startsWith('/').optional(),
      github: z
        .strictObject({ id: z.string().min(1), tokenFile: z.string().startsWith('/') })
        .optional(),
    }),
  ),
});

export function bindings(file: string) {
  const config = configuration.parse(JSON.parse(readFileSync(file, 'utf8')) as unknown);
  const projects = new Map(config.projects.map((project) => [project.remote, project]));
  if (projects.size !== config.projects.length) throw new Error('Duplicate project binding');
  const architecture = new Architecture();
  return {
    operator: config.operator,
    verify: (remote: string, revision: string, reference?: string) =>
      verifyProject(projects.get(remote)?.github, remote, revision, reference),
    evidence: (remote: string) => projects.get(remote)?.evidence,
    hosted: (remote: string) => projects.get(remote)?.hosted === true,
    provider: (remote: string) => projects.get(remote)?.provider,
    assigned(provider: string) {
      return config.projects
        .filter(({ provider: owner, hosted }) => hosted && owner === provider)
        .map(({ remote }) => remote);
    },
    capture(remote: string, revision?: string) {
      const directory = projects.get(remote)?.directory;
      if (!directory) return undefined;
      const capture = architecture.capture(directory, revision);
      if (capture.source.remote !== remote) throw new Error('Bound project remote changed');
      return capture;
    },
  };
}

function privateToken(file: string) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.mode & 0o077 || realpathSync(file) !== file)
    throw new Error('GitHub credential requires a private mounted file');
  return readSecret(file);
}

async function verifyProject(
  binding: { id: string; tokenFile: string } | undefined,
  remote: string,
  revision: string,
  reference?: string,
) {
  if (reference !== undefined && binding?.id !== reference)
    throw new Error('Repository provider binding unavailable');
  if (binding)
    await verifyBoundCommit(remote, revision, { token: privateToken(binding.tokenFile) });
  return revision;
}
