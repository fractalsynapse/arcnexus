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
  repositoryRoot?: string;
  ownership?: {
    paths: string[];
    publicModules: string[];
    directoryExceptions: Array<{ path: string; reason: string }>;
  };
  discovery?: { source: string[]; documentation: string[]; tests: string[]; exclude: string[] };
  coverageExclusions?: Array<{ path: string; reason: string }>;
  inventoryAvailability?: 'captured' | 'requires_repository_binding';
  inventory?: Array<{ path: string; kind: string; sha256: string }>;
}
