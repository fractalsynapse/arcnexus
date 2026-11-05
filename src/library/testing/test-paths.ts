import { posix } from 'node:path';
import type { Component } from '../architecture/components.js';
import { InputError, relativePath } from '../architecture/config.js';

/** Maps a supported package test path to its captured Node profile output without caller path substitution. */
export function compiledTestPath(component: Component, source: string, outputRoot: string): string {
  relativePath(outputRoot);
  return posix.join(outputRoot, relativeTestSource(component, source).replace(/\.ts$/, '.js'));
}

/** Requires proposed and discovered suites to use the captured package test source root. */
export function relativeTestSource(component: Component, source: string): string {
  relativePath(source);
  const root = testSourceRoot(component) + '/';
  if (!source.startsWith(root) || !source.endsWith('.test.ts'))
    throw new Error(`Unsupported test source root or extension: ${source}`);
  return source.slice(root.length);
}

/** Rejects behavioral narrowing disconnected from the captured profile's discoverable test root. */
export function assertBehavioralTestScope(component: Component, paths: string[]): void {
  if (!component.testProfile) return;
  const root = testSourceRoot(component);
  const intersects = paths.some(
    (path) =>
      path === '.' || path === root || path.startsWith(root + '/') || root.startsWith(path + '/'),
  );
  if (!intersects)
    throw new InputError(
      `Behavioral assignment for ${component.id} requires owned regression scope beneath ${root}; request corrected scope instead of widening the active assignment`,
    );
}

/** Anchors Node test discovery and proposed regressions in their declaring package. */
function testSourceRoot(component: Component): string {
  return posix.join(component.schemaVersion >= 5 ? component.repositoryRoot! : '.', 'tests');
}
