import { posix } from 'node:path';
import type { Component } from './components.js';
import { covered, scopePath } from './component-paths.js';
import { validateSchema } from './schema.js';

interface ConversionContext {
  definitionPath: string;
  definitionInOwnerRepository?: boolean;
  packageRoot: string;
  operationIdentities: Record<string, string>;
  verification: string[];
  execution?: {
    director: { component: string; profile: string };
    reviewerProfile: string;
    defaultPackage?: string;
    verificationInputs?: string[];
  };
}

type Declaration = Record<string, unknown>;

type Api = { module?: string; schema?: string };

/** Converts authored structure; whole-catalog validation must establish classification and authority equivalence. */
export class MigrationComponent {
  /** Validates both declaration families and requires recipes to have resolved operation identities. */
  convert(value: unknown, context: ConversionContext): Declaration {
    const input = structuredClone(value) as Component;
    if (input.schemaVersion === 5) return validateSchema('component-v5', input);
    validateSchema('component-v4', input);
    const result = this.intent(input);
    result.reads = input.access.readPaths;
    result.patterns = input.patternIds ?? [];
    result.operations = this.operations(input, context);
    if (input.type === 'package') {
      result.repository = input.repository;
      if (input.repositoryRoot !== '.') result.root = input.repositoryRoot;
    } else if (input.type !== 'platform') {
      result.owns = this.ownership(input, context);
      result.api = this.api(input);
    } else this.platform(input, result, context);
    for (const [key, item] of Object.entries(result)) {
      if (Array.isArray(item) && !item.length && key !== 'owns' && key !== 'reads')
        delete result[key];
      if (key === 'operations' && !Object.keys(item as object).length) delete result[key];
    }
    return validateSchema('component-v5', result);
  }

  /** Retains local architectural purpose and contract promises without retaining implementation inventories. */
  private intent(input: Component): Declaration {
    const result: Declaration = { schemaVersion: 5 };
    for (const key of [
      'id',
      'type',
      'parentId',
      'purpose',
      'objectives',
      'constraints',
      'questions',
      'executionProfile',
      'testProfile',
    ] as const)
      if (input[key] !== undefined) result[key] = input[key];
    result.constraints = [
      ...new Set([
        ...input.constraints,
        ...(input.provides ?? []).map(
          (contract) => `${contract.id} (${contract.path}): ${contract.compatibility}`,
        ),
      ]),
    ];
    return result;
  }

  /** Removes only exact redundant definition ownership, refusing to silently reduce a broader root. */
  private ownership(input: Component, context: ConversionContext): string[] {
    scopePath(context.packageRoot);
    scopePath(context.definitionPath);
    return input.ownership!.paths.filter((path) => {
      scopePath(path);
      if (context.definitionInOwnerRepository === false) return true;
      const resolved = posix.join(context.packageRoot, path);
      if (resolved === context.definitionPath) return false;
      if (covered(context.definitionPath, [resolved]))
        throw new Error(`Broader ownership covers implicit definition: ${input.id}: ${path}`);
      return true;
    });
  }

  /** Preserves public modules and artifact contracts without guessing schema-to-symbol associations. */
  private api(input: Component): Api[] {
    const entries: Api[] = input.ownership!.publicModules.map((module) => ({ module }));
    for (const contract of input.provides ?? [])
      entries.push(
        contract.kind === 'json-schema' ? { schema: contract.path } : { module: contract.path },
      );
    return [...new Map(entries.map((entry) => [JSON.stringify(entry), entry])).values()];
  }

  /** Keeps host verification distinct from agent availability even when they share a definition. */
  private operations(input: Component, context: ConversionContext): Record<string, string[]> {
    if (input.verification.length !== context.verification.length)
      throw new Error(`Unresolved verification recipes: ${input.id}`);
    const result: Record<string, string[]> = {};
    for (const original of input.operationIds ?? []) {
      const id = context.operationIdentities[original];
      if (!id) throw new Error(`Unresolved operation reference: ${input.id}: ${original}`);
      result[id] = ['agent'];
    }
    for (const id of context.verification) {
      if (!id) throw new Error(`Unresolved verification operation: ${input.id}`);
      result[id] = [...new Set([...(result[id] ?? []), 'verify'])];
    }
    return result;
  }

  /** Requires consolidated execution settings instead of dropping or guessing the director's authority. */
  private platform(input: Component, result: Declaration, context: ConversionContext): void {
    if (input.initialization && !context.execution)
      throw new Error(`Unresolved director configuration: ${input.id}`);
    if (
      input.initialization &&
      context.execution?.director.component !== input.initialization.componentId
    )
      throw new Error(`Director identity differs from captured initialization: ${input.id}`);
    if (context.execution) Object.assign(result, context.execution);
  }
}
