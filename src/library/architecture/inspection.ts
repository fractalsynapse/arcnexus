export { StandardResources, type StandardResourceTarget } from './standard-resources.js';

import { ancestry, componentContext, loadCatalog } from './components.js';
import type { Catalog, Component } from './components.js';
import { loadProjectBindings, type Bindings } from './bindings.js';
import { requireActivity, type Activity } from './activities.js';
import { modeSequences, type Mode } from './modes.js';
import { renderFrame } from './frame.js';
import { InputError } from './config.js';

export { ComponentResources, type ComponentResourceTarget } from './component-resources.js';

export interface InspectionRequest {
  source: string;
  revision: string;
  packageId: string;
  componentId: string;
  prompt?: string;
  activity?: string;
}

/** Presents revision-bound architectural context without creating execution authority or accepted work. */
export class ArchitectureInspection {
  /** Validates package scope and projects the same captured catalog used by engineering. */
  inspect(request: InspectionRequest, bindings?: Bindings) {
    this.validate(request);
    const { source, revision, packageId } = request;
    const catalog = loadCatalog(source, revision, bindings ?? loadProjectBindings(source));
    // `director` and `verifier` name positions rather than components, so they resolve to the
    // component that position is exercised on before any ancestry lookup happens.
    const target = position(catalog, request.componentId);
    const context = ancestry(catalog, target.componentId);
    // A reserved position names neither a component nor a package member: `verifier` reviews the goal
    // as the platform that owns verification authority sees it, so the package containment rule that
    // applies to component names is not meaningful for it.
    if (
      positionMode(request.componentId) === 'steward' &&
      !context.some((component) => component.type === 'package' && component.id === packageId)
    )
      throw new InputError('Inspection component is outside the selected package');
    const { component, mode, activity } = resolvePosition(catalog, context, request);
    return {
      mode,
      activity,
      frame: this.frame(catalog, context, request, bindings),
      revision,
      packageId,
      componentId: target.componentId,
      ...inventory(component, context),
      ...(request.prompt !== undefined ? { preview: { prompt: request.prompt, activity } } : {}),
    };
  }

  /**
   * Resolves which position and activity an inspection is asking about, then renders its frame.
   *
   * A mode name in the component slot asks what that position would be shown. Steward remains the
   * default and unnamed, because every component already is the steward view of itself; the
   * director resolves to the component the platform actually directs from.
   */
  private frame(
    catalog: Catalog,
    context: Component[],
    request: InspectionRequest,
    bindings?: Bindings,
  ) {
    const { component, mode, activity } = resolvePosition(catalog, context, request);
    return renderFrame({
      catalog,
      component,
      activity,
      mode,
      ...(request.prompt ? { goal: request.prompt } : {}),
      ...(bindings ? { bindings } : {}),
    });
  }

  /**
   * Lists the components of a package with the activities each holds, as one readable line each.
   *
   * The index exists so an operator can discover a component id and its activities before asking for
   * a frame, rather than guessing identifiers from directory names.
   */
  index(target: { source: string; base: string; packageId: string }, bindings?: Bindings): string {
    const catalog = loadCatalog(
      target.source,
      target.base,
      bindings ?? loadProjectBindings(target.source),
    );
    const rows = Object.values(catalog.components)
      .filter((component) => component.type !== 'platform')
      .map(
        (component) =>
          `${component.id.padEnd(26)} ${component.type.padEnd(10)} ${Object.keys(component.activities ?? {}).join(',')}`,
      );
    return [`package ${target.packageId} at ${target.base.slice(0, 8)}`, ...rows].join('\n');
  }

  /** Rejects empty explicit inputs and unsupported activities before loading source. */
  private validate(request: InspectionRequest): void {
    for (const key of ['source', 'revision', 'packageId', 'componentId', 'prompt'] as const)
      if (request[key] !== undefined && !request[key]!.trim())
        throw new InputError('Empty inspection input: ' + key);
    if (request.activity !== undefined) requireActivity(request.activity, 'inspection');
  }
}

/** The first activity a mode runs that this component actually holds. */
function activityFor(mode: Mode, activities?: Record<string, unknown>): string {
  const held = Object.keys(activities ?? {});
  return modeSequences[mode].find((candidate) => held.includes(candidate)) ?? held[0] ?? 'research';
}

/** The platform whose direction authority the director position borrows. */
function platform(catalog: import('./components.js').Catalog) {
  const platforms = Object.values(catalog.components).filter((c) => c.type === 'platform');
  if (platforms.length !== 1)
    throw new InputError('Inspection needs exactly one platform to resolve direction');
  const declaring = platforms[0];
  if (!declaring?.director) throw new InputError('Platform declares no director component');
  return declaring;
}

/** Which position and activity an inspection is asking about. */
function resolvePosition(
  catalog: Catalog,
  context: Component[],
  request: InspectionRequest,
): { component: Component; mode: Mode; activity: Activity } {
  const mode = positionMode(request.componentId);
  let component = context.at(-1)!;
  if (mode === 'director' && !holds(component, activityFor(mode, component.activities)))
    component = directed(catalog);
  const activity = (
    request.activity
      ? requireActivity(request.activity, 'inspection')
      : activityFor(mode, component.activities)
  ) as Activity;
  return { component, mode, activity };
}

/** True when the component holds this activity at all. */
function holds(component: Component, activity: string): boolean {
  return component.activities?.[activity] !== undefined;
}

/** The component the platform actually directs from. */
function directed(catalog: Catalog): Component {
  const id = platform(catalog).director!.component;
  return catalog.components[id] ?? Object.values(catalog.components).at(-1)!;
}

/** The component's own architectural inventory, as captured at the inspected revision. */
function inventory(component: Component, context: Component[]) {
  return {
    context: context.map(componentContext),
    policy: component.policy,
    publicApi: component.publicApi ?? [],
    imports: component.observedImports ?? [],
    consumers: component.observedConsumers ?? [],
    operations: component.operations ?? {},
  };
}

/** The position named by the component slot: reserved identifiers, or steward for a component. */
function positionMode(componentId: string): Mode {
  return componentId === 'director' || componentId === 'verifier'
    ? (componentId as Mode)
    : 'steward';
}

/** Resolves a reserved position name to the component its frame is drawn from. */
function position(catalog: Catalog, componentId: string): { componentId: string } {
  if (componentId !== 'director' && componentId !== 'verifier') return { componentId };
  const declaring = Object.values(catalog.components).find((c) => c.type === 'platform');
  if (!declaring) throw new InputError('Inspection needs a platform to resolve a position');
  // Direction belongs to the component the platform directs from; verification reviews the goal, so
  // it is drawn against the platform that owns that authority.
  return {
    componentId: componentId === 'director' ? declaring.director!.component : declaring.id,
  };
}
