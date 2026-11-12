import { activityOperationIds, type Activity } from './activities.js';
import { modeSequences, type Mode } from './modes.js';
import type {
  ActivityOperation,
  Catalog,
  Component,
  ComponentActivity,
  Role,
} from './components.js';

/**
 * The one architectural frame every agent is shown.
 *
 * `inspect` and a live activation must present the same architecture, because a context an operator
 * can read is the only context anyone can reason about: if the two diverge, the preview lies about
 * the run and the run is invisible in the preview. That is execution EX-6 and architecture-model
 * ARC-9. The sections here are the *architectural* layers — what the component is, what the activity
 * means inside it, which operations and standards apply. Per-turn runtime state (the goal text as
 * received, checkpoint hashes, inbox, plan, workspace paths) is deliberately not here: it is the
 * layer an activation adds and a preview can only placeholder, and every such placeholder is named in
 * `placeholders` so byte-comparison is a check rather than a hope.
 */
export interface FrameInput {
  catalog: Catalog;
  component: Component;
  activity: Activity;
  mode: Mode;
  /** Goal and acceptance when known; a preview substitutes the placeholders named below. */
  goal?: string;
  acceptance?: string[];
  milestone?: Record<string, unknown>;
  bindings?: unknown;
}

/** What the frame resolves for one activity: the position, its direction, and its reachable operations. */
export interface ActivityFrame {
  activity: Activity;
  role: Role;
  instructions: string[];
  standards: string[];
  operations: Array<{ id: string; usage?: string; with?: Record<string, unknown> }>;
  profile?: string;
}

/**
 * Resolves the activity as the component configured it: role, direction and allowed operations.
 *
 * Undefined here is a real error rather than an empty frame — an agent must never be shown a
 * vocabulary it was not authorized to use, and a component that does not hold the activity has no
 * correct answer to render.
 */
export function activityFrame(input: FrameInput): ActivityFrame {
  const { catalog, component, activity, mode } = input;
  const declared = component.activities?.[activity];
  if (!declared)
    throw new Error(`Component ${component.id} does not hold the activity ${activity}`);
  const role = catalog.roles[declared.role];
  if (!role)
    throw new Error(
      `Component ${component.id}.${activity} names an unknown role: ${declared.role}`,
    );
  if (!modeSequences[mode].includes(activity))
    throw new Error(`Mode ${mode} does not run the activity ${activity}`);
  return {
    activity,
    role,
    instructions: activityInstructions(declared),
    standards: standardsInForce(catalog, component, role, declared),
    operations: (declared.operations ?? []).map(toOperation),
    ...(declared.profile ? { profile: declared.profile } : {}),
  };
}

/** Operations an activity may perform, in whichever notation the component used. */
function toOperation(entry: ActivityOperation): {
  id: string;
  usage?: string;
  with?: Record<string, unknown>;
} {
  if (typeof entry === 'string') return { id: entry };
  return {
    id: entry.id,
    ...(entry.usage ? { usage: entry.usage } : {}),
    ...(entry.with ? { with: entry.with } : {}),
  };
}

/**
 * The component's direction for an activity, then the position's own standing instructions.
 *
 * Order is not cosmetic: the component statement says what this activity means *here*, and the role
 * statement is reusable résumé text. Reading component-first means local authority is never
 * overwritten by a generic description of the same position.
 */
function activityInstructions(declared: ComponentActivity): string[] {
  return [...(declared.instructions ?? [])];
}

/**
 * Standards in force for one activity - the single resolver both frame paths use.
 *
 * Architecture-model I8 attaches standards to activities rather than bespoke prompts, shared once
 * per catalog; the architect's 2026-11-12 ruling adds that a component, an activity and a position
 * may each declare them. The set is therefore their union, kept to ids the catalog actually knows
 * so a typo cannot claim authority. Assignment capture calls the same function rather than keeping
 * its own copy, because two resolvers are how an activation and an inspection drift apart.
 */
export function standardsInForce(
  catalog: Catalog,
  component: Component,
  role: Role,
  activity?: ComponentActivity,
): string[] {
  const known = new Set(
    (catalog.standards ?? []).map((standard) => (standard as { id: string }).id),
  );
  return [
    ...new Set([
      ...(component.standards ?? []),
      ...(role.standards ?? []),
      ...(activity?.standards ?? []),
    ]),
  ].filter((id) => known.has(id));
}

/** Everything one frame states, whether resolved from a catalog or from a captured assignment. */
export interface ResolvedFrame {
  component: Component;
  activity: Activity;
  mode: Mode;
  position: Role;
  instructions: string[];
  standards: string[];
  operations: Array<{ id: string; usage?: string; with?: Record<string, unknown> }>;
  profile?: string;
  goal?: string;
  acceptance?: string[];
  milestone?: Record<string, unknown>;
  knownOwners?: string[];
}

/** Names the layers a preview cannot know, so equality against a live frame is checkable. */
export const framePlaceholders = [
  'goal',
  'acceptance',
  'milestone',
  'plan',
  'checkpoint',
  'inbox',
  'workspace',
] as const;

/**
 * Renders the architectural frame from already-resolved parts.
 *
 * This is the single renderer both `inspect` and a live activation go through: `inspect` resolves
 * the parts from the catalog at a revision, an activation resolves them from the assignment it
 * captured at dispatch, and neither may hold its own copy of this text. Sections emit in fixed
 * order, collections keep declared order, and nothing reads the clock, the filesystem or a hostname,
 * so two renders of the same parts are byte-identical and a difference is always a real change.
 */
export function renderResolvedFrame(frame: ResolvedFrame): string {
  const goal = frame.goal ?? '[placeholder:goal]';
  const acceptance = frame.acceptance ?? ['[placeholder:acceptance]'];
  const lines = [
    `Mode: ${frame.mode} \u00b7 Activity: ${frame.activity} \u00b7 Position: ${frame.position.id}`,
    `Position purpose: ${frame.position.purpose}`,
    `Position responsibilities: ${frame.position.responsibilities.join(' | ')}`,
    `Component: ${frame.component.id} (${frame.component.type}) \u00b7 owns ${(frame.component.owns ?? []).join(', ')}`,
    `Component purpose: ${frame.component.purpose}`,
    `Goal: ${goal}`,
    `Acceptance: ${acceptance.join(' | ')}`,
    `Activity direction: ${frame.instructions.join(' | ') || 'none declared beyond the position'}`,
    `Operations this activity may run: ${
      frame.operations
        .map((op) => `${op.id}${op.with ? `(${Object.keys(op.with).join(',')})` : ''}`)
        .join(', ') || 'none'
    }`,
    `Standards in force: ${frame.standards.join(', ') || 'none'}`,
    `Execution profile: ${frame.profile ?? `component default ${frame.component.executionProfile}`}`,
  ];
  if (frame.knownOwners) lines.push(`Known owners: ${frame.knownOwners.join(', ')}`);
  if (frame.milestone) lines.push(`Milestone: ${JSON.stringify(frame.milestone)}`);
  return lines.join('\n');
}

/**
 * Resolves an activity from the catalog and renders its frame — the `inspect` entry point.
 *
 * An activation reaches the same renderer through `renderResolvedFrame` with parts resolved from its
 * captured assignment; both paths must agree, which is what makes EX-6 checkable.
 */
export function renderFrame(input: FrameInput): string {
  const frame = activityFrame(input);
  return renderResolvedFrame({
    component: input.component,
    activity: frame.activity,
    mode: input.mode,
    position: frame.role,
    instructions: frame.instructions,
    standards: frame.standards,
    operations: frame.operations,
    ...(frame.profile ? { profile: frame.profile } : {}),
    ...(input.goal ? { goal: input.goal } : {}),
    ...(input.acceptance ? { acceptance: input.acceptance } : {}),
    ...(input.milestone ? { milestone: input.milestone } : {}),
    knownOwners: catalogComponentIds(input.catalog),
  });
}

/** Component ids in catalog order, used so the same catalog always renders the same line. */
function catalogComponentIds(catalog: Catalog): string[] {
  return Object.keys(catalog.components);
}

export { activityOperationIds };
