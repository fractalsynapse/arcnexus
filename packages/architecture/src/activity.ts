import { team } from '../../team/src/index.js';
import type { Capture } from './catalog.js';

export interface ActivitySelection {
  component: string;
  activity: string;
}

/** Resolve the special actor bindings and ordinary declared activities. */
export function resolveActivity(capture: Capture, selection: ActivitySelection) {
  const id = componentID(capture, selection);
  const component = team.list(capture.components, { component: id })[0];
  if (!component) {
    throw new Error(
      `Unknown component: ${id}; valid components: ${Object.keys(capture.components).join(', ')}`,
    );
  }
  const name = selection.activity;
  const activity =
    component.activities && Object.hasOwn(component.activities, name)
      ? component.activities[name]
      : undefined;
  if (!activity) {
    throw new Error(
      `Unknown activity: ${name}; valid activities for ${id}: ${Object.keys(component.activities ?? {}).join(', ')}`,
    );
  }
  const { director, verifier } = capture.project;
  const actor = matches(director, id, name)
    ? 'director'
    : matches(verifier, id, name)
      ? 'reviewer'
      : 'steward';
  if (activity.executor === 'host')
    throw new Error(`Activity ${id}/${name} is host-only and has no Codex request`);
  return { actor, component, name, activity } as const;
}

/** Translate reserved actor selectors while preserving direct component selection. */
function componentID(capture: Capture, selection: ActivitySelection) {
  const { director, verifier } = capture.project;
  const alias =
    selection.component === 'director'
      ? director
      : selection.component === 'reviewer' &&
          (selection.activity === verifier.activity ||
            !Object.hasOwn(capture.components, 'reviewer'))
        ? verifier
        : undefined;
  if (alias && selection.activity !== alias.activity) {
    throw new Error(
      `Unknown activity for ${selection.component}; valid activity: ${alias.activity}`,
    );
  }
  return alias?.component ?? selection.component;
}

/** Identify special actors by both the captured component and activity. */
function matches(binding: ActivitySelection, component: string, activity: string) {
  return binding.component === component && binding.activity === activity;
}
