import type { Context } from 'cordis';
import { posix } from 'node:path';
import { parse } from 'yaml';

export interface GuidanceSource {
  readonly paths: readonly string[];
  read(path: string): string;
}

declare module 'cordis' {
  interface Context {
    manager: Manager;
  }
}

/** Resolve directives and skill descriptions from the admitted revision. */
export class Manager {
  /** Return root and owner-scoped directives, and list discoverable skills. */
  guidanceFor(source: GuidanceSource, owns: readonly string[], activeSkills: readonly string[]) {
    const directives = source.paths
      .filter((path) => applies(path, owns))
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
      .map((path) => ({ path, text: source.read(path) }));
    const skills = source.paths
      .filter((path) => /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(path))
      .map((path) => readSkill(source, path, activeSkills));
    for (const name of activeSkills) {
      if (!skills.some((skill) => skill.name === name))
        throw new Error(`Unknown guidance skill: ${name}`);
    }
    return { directives, skills };
  }
}

/** A nested directive applies inside a root owned by the selected component. */
function applies(path: string, owns: readonly string[]) {
  if (path === 'AGENTS.md') return true;
  if (posix.basename(path) !== 'AGENTS.md') return false;
  const directory = posix.dirname(path);
  return owns.some(
    (root) =>
      root === directory || root.startsWith(directory + '/') || directory.startsWith(root + '/'),
  );
}

/** Read metadata and expose full text for a skill selected for the activity. */
function readSkill(source: GuidanceSource, path: string, selected: readonly string[]) {
  const text = source.read(path);
  const metadata = parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '') as {
    name?: string;
    description?: string;
  } | null;
  const name = posix.basename(posix.dirname(path));
  if (
    metadata?.name !== name ||
    typeof metadata.description !== 'string' ||
    !metadata.description
  ) {
    throw new Error(`Invalid guidance metadata: ${path}`);
  }
  return {
    name,
    description: metadata.description,
    path,
    ...(selected.includes(name) ? { text } : {}),
  };
}

/** Mount the guidance reader in the trusted composition. */
export function managerPlugin(context: Context) {
  context.provide('manager', new Manager());
}
