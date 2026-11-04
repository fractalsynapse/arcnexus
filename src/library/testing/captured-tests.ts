import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyComponentPath, type Catalog, type Component } from '../architecture/components.js';
import { git } from '../operations/process.js';
import { SuiteMetadataReader } from './metadata.js';
import { loadTestProfile } from './profile.js';
import type { SuiteMetadata } from './suite.js';
import { TestDiscovery } from './discovery.js';
import { relativeTestSource } from './test-paths.js';

export interface CapturedTest extends SuiteMetadata {
  source: string;
  sha256: string;
}

export { compiledTestPath } from './test-paths.js';

/** Captures mandatory suite identities before candidate edits can affect discovery. */
export function captureComponentTests(catalog: Catalog, repository: string, base: string): void {
  const profiles = new Set<string>();
  for (const component of Object.values(catalog.components)) {
    if (!component.testProfile) continue;
    const profile = loadTestProfile(repository, base, component.testProfile);
    if (!profiles.has(profile.id)) catalog.configurationSources.push(profile.configuration);
    profiles.add(profile.id);
    const revision = catalog.repositoryRevisions?.[component.repository];
    if (!revision) continue;
    component.capturedTests = (component.inventory ?? [])
      .filter(
        (file) =>
          file.kind === 'tests' &&
          file.path.endsWith('.test.ts') &&
          !file.path.split('/').includes('support'),
      )
      .map((file) => ({
        ...new SuiteMetadataReader().read(
          file.path,
          git(revision.source, 'show', `${revision.base}:${file.path}`),
        ),
        source: file.path,
        sha256: file.sha256,
      }));
    if (component.capturedTests.some((suite) => suite.component !== component.id))
      throw new Error(`Captured test owner mismatch: ${component.id}`);
  }
}

/** Rejects deletion or selection-metadata changes to suites captured for host verification. */
export function assertCapturedTests(component: Component, workspace: string): void {
  for (const captured of component.capturedTests ?? []) {
    const current = new SuiteMetadataReader().read(
      captured.source,
      readFileSync(join(workspace, captured.source), 'utf8'),
    );
    if (
      current.component !== captured.component ||
      current.level !== captured.level ||
      JSON.stringify([...(current.tags ?? [])].sort()) !==
        JSON.stringify([...(captured.tags ?? [])].sort())
    )
      throw new Error(`Candidate changed mandatory test selection: ${captured.source}`);
  }
}

/** Validates suite registration and captured selection before a host edit transaction starts. */
export function assertCapturedTestEdit(
  component: Component,
  path: string,
  content: string | null,
): void {
  const captured = component.capturedTests?.find((suite) => suite.source === path);
  if (!captured) return assertNewTestEdit(component, path, content);
  if (content === null) throw new Error(`Cannot delete captured mandatory suite: ${path}`);
  const current = new SuiteMetadataReader().read(path, content);
  if (
    current.component !== captured.component ||
    current.level !== captured.level ||
    JSON.stringify([...(current.tags ?? [])].sort()) !==
      JSON.stringify([...(captured.tags ?? [])].sort())
  )
    throw new Error(`Preserve captured suite component, level and tags: ${path}`);
}

/** Applies normal discovery rules to new suites while leaving helper and ordinary source files alone. */
function assertNewTestEdit(component: Component, path: string, content: string | null): void {
  if (
    content === null ||
    !component.testProfile ||
    !path.endsWith('.test.ts') ||
    path.split('/').includes('support') ||
    classifyComponentPath(component, path) !== 'tests'
  )
    return;
  relativeTestSource(component, path);
  new SuiteMetadataReader().readOwned(component.id, path, content);
}

/** Selects current owned suites using captured rules and refuses changes to mandatory identities. */
export function currentComponentTests(component: Component, workspace: string, outputRoot: string) {
  assertCapturedTests(component, workspace);
  return new TestDiscovery(workspace).discover(component, outputRoot);
}

export type { DiscoveredSuite } from './discovery.js';
