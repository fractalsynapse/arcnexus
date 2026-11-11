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
    standards: standardIds(catalog, component, role),
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
 * Standards in force for this activity: the component's own, plus those the position carries.
 *
 * Architecture-model I8 says standards attach to activities rather than bespoke prompts and are
 * shared once per catalog. Before this, standards were attached by component only, so an activity
 * inside a component inherited every standard that component had ever needed.
 */
function standardIds(catalog: Catalog, component: Component, role: Role): string[] {
  const known = Object.keys(catalog.standards ?? {});
  return [...new Set([...(component.standards ?? []), ...(role.standards ?? [])])].filter((id) =>
    known.includes(id),
  );
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
 * Renders the architectural frame as ordered text.
 *
 * Deterministic by construction: every section is emitted in this fixed order, collections keep the
 * order the catalog declared them in, and nothing here reads the clock, the filesystem or a hostname.
 */
export function renderFrame(input: FrameInput): string {
  const frame = activityFrame(input);
  const { component, mode, catalog } = input;
  const goal = input.goal ?? `[placeholder:goal]`;
  const acceptance = input.acceptance ?? ['[placeholder:acceptance]'];
  const lines = [
    `Mode: ${mode} · Activity: ${frame.activity} · Position: ${frame.role.id}`,
    `Position purpose: ${frame.role.purpose}`,
    `Position responsibilities: ${frame.role.responsibilities.join(' | ')}`,
    `Component: ${component.id} (${component.type}) · owns ${(component.owns ?? []).join(', ')}`,
    `Component purpose: ${component.purpose}`,
    `Goal: ${goal}`,
    `Acceptance: ${acceptance.join(' | ')}`,
    `Activity direction: ${frame.instructions.join(' | ') || 'none declared beyond the position'}`,
    `Operations this activity may run: ${
      frame.operations
        .map((op) => `${op.id}${op.with ? `(${Object.keys(op.with).join(',')})` : ''}`)
        .join(', ') || 'none'
    }`,
    `Standards in force: ${frame.standards.join(', ') || 'none'}`,
    `Execution profile: ${frame.profile ?? `component default ${component.executionProfile}`}`,
    `Known owners: ${catalogComponentIds(catalog).join(', ')}`,
  ];
  if (input.milestone) lines.push(`Milestone: ${JSON.stringify(input.milestone)}`);
  return lines.join('\n');
}

/** Component ids in catalog order, used so the same catalog always renders the same line. */
function catalogComponentIds(catalog: Catalog): string[] {
  return Object.keys(catalog.components);
}

export { activityOperationIds };
