import { join } from 'node:path';
import { ExecutionContext, type ProjectExecution } from '../architecture/execution-context.js';
import { InputError } from '../architecture/config.js';
import { githubBranchHead } from '../operations/github-upstream.js';
import { PublicationPolicy } from '../publisher/publisher.js';
import { runDestination } from './run-destination.js';

/** Pins live engineering and promotion to upstream staging before a host can capture working authority. */
export async function stagingContext(
  source: string,
  packageId: string,
  projectDirectory: string,
  repository: string,
  branch: string,
  signal: AbortSignal,
): Promise<ProjectExecution> {
  const base = await githubBranchHead(repository, branch, signal, {
    source,
    evidence: join(projectDirectory, 'target-observations'),
  });
  const context = new ExecutionContext().resolve(source, packageId, base);
  const policy = new PublicationPolicy().resolve(context);
  if (policy?.operation.targetBranch !== branch || runDestination(context, 'live') !== repository)
    throw new InputError(
      `Execution requires a matching publication grant on ${repository}/${branch} at ${base}`,
    );
  return context;
}
