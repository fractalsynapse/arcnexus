import type { Operation } from '../operations/operations.js';
import { posix } from 'node:path';
import { validateSchema } from './schema.js';

/** Distinguishes invalid invocation or configuration from execution failures. */
export class InputError extends Error {}

export interface Command {
  command: string;
  args: string[];
}

export type VerificationCheck = Command | Operation;

export interface Dependency {
  id: string;
  repository: string;
  commit: string;
  path: string;
  prerequisites: Command[];
  setup: Command[];
  generatedDirectories: string[];
}

export interface WorkspaceDefinition {
  primary: { id: string; repository?: string };
  dependencies: Dependency[];
}

export interface Environment {
  workspace?: WorkspaceDefinition;
  schemaVersion: 4;
  prerequisites: Command[];
  setup: Command[];
  generatedDirectories: string[];
}

export function relativePath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value === '.' ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('\0') ||
    posix.normalize(value) !== value ||
    value.split('/').some((p) => p === '..' || p.toLowerCase() === '.git')
  )
    throw new InputError(`Invalid relative path: ${String(value)}`);
  return value;
}

export function commands(value: unknown): Command[] {
  if (!Array.isArray(value)) throw new InputError('Expected command array');
  return value.map((c) => {
    if (
      !c ||
      typeof c.command !== 'string' ||
      !c.command ||
      c.command.includes('\0') ||
      !Array.isArray(c.args) ||
      !c.args.every((a: unknown) => typeof a === 'string' && !a.includes('\0'))
    )
      throw new InputError('Invalid command/args');
    return { command: c.command, args: c.args };
  });
}

export function environment(value: unknown, operations: Operation[] = []): Environment {
  const version = (value as { schemaVersion?: number } | null)?.schemaVersion;
  if (version === 4) {
    if (operations.some((op) => op.schemaVersion !== 4))
      throw new InputError('Shared environments require current operation definitions');
    return sharedEnvironment(value, operations);
  }
  throw new InputError('Environment must be a shared architecture environment definition');
}

/** Derives disposable outputs from operation definitions while keeping composition recipe-free. */
function sharedEnvironment(value: unknown, operations: Operation[]): Environment {
  const input = validateSchema<{ schemaVersion: 4; workspace: WorkspaceDefinition }>(
    'environment-v4',
    value,
  );
  const outputs = (id: string) =>
    [
      ...new Set(
        operations.filter((op) => op.repository === id).flatMap((op) => op.generatedDirectories),
      ),
    ].map(relativePath);
  const result: Environment = {
    schemaVersion: 4,
    prerequisites: [],
    setup: [],
    generatedDirectories: outputs(input.workspace.primary.id),
    workspace: {
      primary: input.workspace.primary,
      dependencies: input.workspace.dependencies.map((member) => ({
        ...member,
        prerequisites: [],
        setup: [],
        generatedDirectories: outputs(member.id),
      })),
    },
  };
  validateWorkspace(result);
  return result;
}

function validateWorkspace(v: Environment): void {
  if (v.workspace) {
    const seen = new Set([v.workspace.primary.id]);
    const paths: string[] = [];
    for (const member of v.workspace.dependencies) {
      relativePath(member.path);
      commands(member.prerequisites);
      commands(member.setup);
      member.generatedDirectories.forEach(relativePath);
      if (seen.has(member.id)) throw new InputError('Duplicate workspace member identity');
      seen.add(member.id);
      if (
        paths.some(
          (p) =>
            p === member.path || p.startsWith(member.path + '/') || member.path.startsWith(p + '/'),
        )
      )
        throw new InputError('Overlapping dependency mounts');
      paths.push(member.path);
      if (
        v.generatedDirectories.some(
          (p) =>
            p === member.path || p.startsWith(member.path + '/') || member.path.startsWith(p + '/'),
        )
      )
        throw new InputError('Dependency mount overlaps disposable generated directory');
    }
  }
}
