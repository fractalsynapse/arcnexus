import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './source.js';
import { load, readProject, type Component } from './catalog.js';
import { ownershipFindings, type OwnershipFinding } from './ownership.js';

export interface OwnershipAudit {
  source: { kind: 'working-tree'; root: string; remote: string; revision: string };
  paths: readonly string[];
  findings: readonly OwnershipFinding[];
}

/** Audit mutable declarations and the Git index inventory without capturing authority. */
export function checkOwnership(directory: string): OwnershipAudit {
  const root = git(directory, 'rev-parse', '--show-toplevel').replace(/\n$/, '');
  const remote = git(root, 'config', '--get', 'remote.origin.url').trim();
  const revision = git(root, 'rev-parse', '--verify', 'HEAD^{commit}').trim();
  const inventory = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard');
  const paths = [...new Set(inventory.split('\0').filter(Boolean))].sort();
  const source = {
    paths,
    read: (path: string) => readFileSync(join(root, path), 'utf8'),
  };
  readProject(source, remote);
  const components = load<Component>(source, 'components');
  for (const component of Object.values(components)) {
    if (
      !Array.isArray(component.owns) ||
      !component.owns.every((path) => typeof path === 'string')
    )
      throw new Error(`Invalid catalog ownership: ${component.id}`);
  }
  return {
    source: { kind: 'working-tree', root, remote, revision },
    paths,
    findings: ownershipFindings(components, paths),
  };
}
