import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { z } from 'zod';
import {
  Architecture,
  documentationCapture,
  openProject,
  projectCatalogPath,
} from '../../architecture/src/index.js';
import {
  githubAppReadToken,
  managedRepository,
  verifyBoundCommit,
} from '../../collaboration/src/index.js';
import { readSecret } from './database.js';
import { importSchema } from '../../catalog/src/index.js';

const id = z.string().min(1);
const absoluteSecret = z.string().startsWith('/');
const evidenceRoots = z.union([absoluteSecret, z.array(absoluteSecret).nonempty()]);
const githubBinding = z.union([
  z.strictObject({ id, tokenFile: absoluteSecret }),
  z.strictObject({ id, appId: z.string().min(1), privateKeyFile: absoluteSecret }),
]);

const configuration = z.strictObject({
  operator: z.string().min(1),
  projects: z.array(
    z.strictObject({
      directory: z.string().min(1),
      remote: importSchema.shape.remote,
      hosted: z.boolean().optional(),
      documentationOnly: z.literal(true).optional(),
      managed: z.boolean().optional(),
      provider: z.uuid().optional(),
      evidence: evidenceRoots.optional(),
      github: githubBinding.optional(),
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
    verify: (remote: string, reference?: string) =>
      verifyProject(architecture, projects.get(remote), reference),
    evidence: (remote: string) => projects.get(remote)?.evidence,
    hosted: (remote: string) => projects.get(remote)?.hosted === true,
    documentationOnly: (remote: string) => projects.get(remote)?.documentationOnly === true,
    provider: (remote: string) => projects.get(remote)?.provider,
    assigned(provider: string) {
      return config.projects
        .filter(
          ({ provider: owner, hosted, documentationOnly }) =>
            (hosted || documentationOnly) && owner === provider,
        )
        .map(({ remote }) => remote);
    },
    capture: (remote: string, revision?: string) =>
      captureBinding(architecture, projects.get(remote), revision),
  };
}

function captureBinding(architecture: Architecture, project?: ProjectBinding, revision?: string) {
  if (!project) return undefined;
  const source = openProject(project.directory, revision);
  if (source.remote !== project.remote) throw new Error('Bound project remote changed');
  if (project.documentationOnly || !source.paths.includes(projectCatalogPath))
    return documentationCapture(source);
  return architecture.resolve(source);
}

function privateCredential(file: string) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.mode & 0o077 || realpathSync(file) !== file)
    throw new Error('GitHub credential requires a private mounted file');
  return readSecret(file);
}

type ProjectBinding = z.output<typeof configuration>['projects'][number];

async function verifyProject(
  architecture: Architecture,
  project?: ProjectBinding,
  reference?: string,
) {
  if (!project) throw new Error('Repository is not bound for isolated review');
  const { remote, directory, github, managed } = project;
  if (reference !== undefined && github?.id !== reference)
    throw new Error('Repository provider binding unavailable');
  const token = github && (await repositoryToken(remote, github));
  const pinned = managed ? await managedRepository({ remote, directory, token }) : undefined;
  const source = project.documentationOnly
    ? openProject(directory, pinned)
    : architecture.capture(directory, pinned).source;
  if (source.remote !== remote) throw new Error('Bound project remote changed');
  if (token) await verifyBoundCommit(remote, source.revision, { token });
  return { revision: source.revision, credential: github?.id };
}

async function repositoryToken(remote: string, binding: z.output<typeof githubBinding>) {
  if ('tokenFile' in binding) return privateCredential(binding.tokenFile);
  return githubAppReadToken(remote, {
    appId: binding.appId,
    privateKey: privateCredential(binding.privateKeyFile),
  });
}
