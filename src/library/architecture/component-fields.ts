import type { ContractDefinition, ReferenceArtifact } from './references.js';

/**
 * The resolved fields a component acquires from its lineage and captured source.
 *
 * These are authored by inheritance and capture rather than by hand, so they sit apart from the
 * declared shape: a component states intent, and the resolver fills in what the repository and
 * test materialization make true. They are grouped here because ownership, inventory and snapshot
 * fields are all derived the same way, from the same inputs.
 */
export interface ComponentFields {
  testProfile?: string;
  capturedTests?: import('../testing/captured-tests.js').CapturedTest[];
  provides?: ContractDefinition[];
  consumes?: Array<{ id: string; version: string }>;
  patternSnapshots?: Array<{ id: string; artifacts: ReferenceArtifact[] }>;
  providedSnapshots?: Array<ContractDefinition & { owner: string; artifact?: ReferenceArtifact }>;
  contractSnapshots?: Array<ContractDefinition & { owner: string; artifact?: ReferenceArtifact }>;
  repositoryRoot?: string;
  ownership?: {
    paths: string[];
    publicModules: string[];
    directoryExceptions: Array<{ path: string; reason: string }>;
  };
  discovery?: { source: string[]; documentation: string[]; tests: string[]; exclude: string[] };
  coverageExclusions?: Array<{ path: string; reason: string }>;
  patternIds?: string[];
  inventoryAvailability?: 'captured' | 'requires_repository_binding';
  inventory?: Array<{ path: string; kind: string; sha256: string }>;
}
