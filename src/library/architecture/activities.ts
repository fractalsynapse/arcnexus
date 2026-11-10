import { InputError } from './config.js';

/**
 * The activities an agent may perform, in the one order every plan and activation must follow.
 *
 * An activity is the spine of a plan: checklist items are bucketed by activity, the buckets run
 * in this order, and standards, operations and execution profiles select work by this name. A
 * role declares which of these it supports; this module owns the names and their order so a
 * second vocabulary cannot appear for the same concept.
 */
export const activityOrder = [
  'research',
  'documentation',
  'testing',
  'implementation',
  'review',
  'release',
] as const;

export type Activity = (typeof activityOrder)[number];

const known = new Set<string>(activityOrder);

/** Position of an activity in the canonical order; unknown names sort last. */
export function activityRank(activity: string): number {
  const rank = activityOrder.indexOf(activity as Activity);
  return rank < 0 ? activityOrder.length : rank;
}

/**
 * Validates a bare activity name and returns it.
 *
 * Used where a caller supplies an activity directly, such as context rendering. A rejected name
 * names the valid values so the caller can correct the request rather than guess.
 */
export function requireActivity(value: string, context: string): Activity {
  if (!known.has(value))
    throw new InputError(
      `Unsupported activity for ${context}: ${value}. Valid activities: ${activityOrder.join(', ')}`,
    );
  return value as Activity;
}

/**
 * Validates a declared activity list and returns it in canonical order.
 *
 * Roles and components declare activities; declaration order carries no meaning, so resolution
 * orders them here and refuses any name outside the canonical set. Duplicate declarations are
 * refused because two buckets for one activity would have no defined precedence.
 */
export function declareActivities(values: readonly string[], context: string): Activity[] {
  const checked = values.map((value) => requireActivity(value, context));
  const repeated = checked.find((value, index) => checked.indexOf(value) !== index);
  if (repeated) throw new InputError(`Duplicate activity declaration: ${context}: ${repeated}`);
  return [...checked].sort((a, b) => activityRank(a) - activityRank(b));
}

/** Reports the activities a role supports that a plan still has to populate. */
export function missingActivities(
  declared: readonly string[],
  planned: readonly string[],
): string[] {
  return declared.filter((activity) => !planned.includes(activity));
}
