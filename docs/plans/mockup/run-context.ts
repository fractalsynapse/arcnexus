import { data, state, requireValue } from './model.ts';
import type { Stats, Activation, PlanStep, Milestone } from './model.ts';
import { ogsmGoal } from './ogsm-example.ts';
import { exampleStrategy } from './ogsm.ts';
import { releaseCheckpoint } from './release-evidence.ts';
import {
  measuredDuration,
  localDate,
  noData,
  commitReferences,
  escape,
  icon,
  status,
  options,
  outcomeName,
  factList,
} from './view.ts';

const runGoals = [...data.goals, ogsmGoal];

export function currentGoal() {
  return requireValue(runGoals.find((goal) => goal.id === state.goal));
}

export function currentSnapshot() {
  const goal = currentGoal();
  return (
    goal.snapshots.find((item) => String(item.seq) === state.runRevision) ||
    requireValue(goal.snapshots[0])
  );
}

export function currentPlan() {
  const goal = currentGoal();
  const snapshot = currentSnapshot();
  return goal.plan.findLast((plan) => plan.seq < snapshot.seq);
}

export function goalControl() {
  return (
    '<label class="arc-goal-control">Standing goal<select data-change="run-goal">' +
    options(
      runGoals.map((goal) => [
        goal.id,
        (goal === ogsmGoal ? 'Example' : goal.priority) + ' · ' + goal.title,
      ]),
      state.goal,
    ) +
    '</select></label>'
  );
}

export function revisionControl() {
  const goal = currentGoal();
  const snapshots = goal.snapshots;
  if (snapshots.length === 1 && currentSnapshot().kind === 'satisfied') {
    return '<small class="arc-mono">Run ' + requireValue(snapshots[0]).run + '</small>';
  }
  return (
    `<label>${goal === ogsmGoal ? 'Example release state' : 'Run revision'}<select data-change="run-revision">` +
    options(
      snapshots.map((v) => [
        String(v.seq),
        v.label ?? (outcomeName(v.kind) + ' · ' + localDate(v.at).split(', ').at(-1)),
      ]),
      String(currentSnapshot().seq),
    ) +
    '</select></label>'
  );
}

export function stage(name: string, route: string, content: string, wrapped = true) {
  return (
    '<section class="arc-surface"><div class="arc-panel-head"><button type="button" data-go="' +
    route +
    '" class="arc-stage-link">' +
    name +
    icon('arrow-up-right') +
    '</button></div>' +
    (wrapped ? '<div class="arc-body">' + content + '</div>' : content) +
    '</section>'
  );
}

export function strategy(compact = false) {
  const selected = currentGoal();
  if (selected === ogsmGoal) return exampleStrategy(compact);
  const plan = currentPlan();
  if (!plan) {
    const summary = selected.outcome.summary;
    const text = compact ? summary.split(/(?<=\.) /, 2).join(' ') : summary;
    return (
      `<h3>${escape(selected.title)}</h3>` +
      (text ? `<p>${commitReferences(text)}</p>` : noData('No plan at this recorded revision.'))
    );
  }
  return (
    `<h3>${commitReferences(plan.purpose)}</h3>` +
    (compact
      ? ''
      : `<h3>Objectives</h3>${factList(plan.objectives)}<h3>Constraints</h3>${factList(plan.constraints)}`)
  );
}

export function cursor() {
  return currentGoal().positions.findLast((p) => p.seq <= currentSnapshot().seq);
}

export function stepState(milestone: Milestone, step: PlanStep, index: number) {
  if (step.inapplicable) return 'Inapplicable';
  const snap = currentSnapshot();
  if (step.activity === 'release')
    return releaseCheckpoint(currentGoal(), snap, milestone) ? 'Checkpoint published' : 'Checkpoint unrecorded';
  const p = cursor();
  if (!p) return 'Waiting';
  const next = p.activities[milestone.id];
  if (next === undefined) return 'Waiting';
  if (index < next) return 'Complete';
  if (next === index && snap.kind === 'cancelled') return 'Interrupted';
  return 'Waiting';
}

export function milestoneState(m: Milestone, ordinal: number) {
  const selected = currentSnapshot();
  const end = cursor();
  if (end && ordinal < end.completed) return 'Complete';
  if (selected.kind === 'cancelled' && end && ordinal === end.completed) return 'Interrupted';
  return 'Waiting';
}

export function assignments(compact = false) {
  const list = currentPlan()?.milestones ?? [];
  if (!list.length)
    return `<div class="arc-body">${noData('No engineering milestones for this assessment.')}</div>`;
  const owners = [...new Set(list.map(({ owner }) => owner))];
  return owners.map((owner) => assignmentRow(owner, list, compact)).join('');
}

function assignmentRow(owner: string, list: Milestone[], compact: boolean) {
  const work = list.filter((m) => m.owner === owner);
  const states = work.map((m) => milestoneState(m, list.indexOf(m)));
  const label = states.includes('Interrupted')
    ? 'Interrupted'
    : states.every((v) => v === 'Complete')
      ? 'Complete'
      : 'Waiting';
  const count = work.length + (work.length === 1 ? ' milestone' : ' milestones');
  return `<button type="button" class="arc-list-row" data-component="${escape(owner)}">
    <span><b>${escape(owner)}</b>${compact ? '' : `<small class="arc-assignment-count">${count}</small>`}</span>
    ${status(label)}${icon('chevron-right')}
  </button>`;
}

export function currentMilestone() {
  const list = currentPlan()?.milestones.filter((m) => m.owner === state.component) || [];
  return list.find((m) => m.id === state.milestone) || list[list.length - 1];
}

export function stepName(name: string) {
  return (
    (
      {
        documentation: 'Documentation',
        testing: 'Testing',
        implementation: 'Implementation',
        review: 'Self-review',
        release: 'Release',
      } as Record<string, string>
    )[name] || name
  );
}

export function workActivities(milestone?: Milestone) {
  if (!milestone)
    return (
      '<div class="arc-body">' + noData('No activity assignments at this revision.') + '</div>'
    );
  return milestone.steps
    .map(
      (step, index) =>
        '<button type="button" class="arc-list-row" data-activity="' +
        escape(step.activity) +
        '"><span><b>' +
        escape(stepName(step.activity)) +
        '</b></span>' +
        status(stepState(milestone, step, index)) +
        icon('chevron-right') +
        '</button>',
    )
    .join('');
}

export function scopedActs(
  component: string,
  activity: string | null = null,
  milestone: string | null = null,
) {
  const snap = currentSnapshot();
  return currentGoal().activations.filter(
    (a) =>
      a.sequence <= snap.seq &&
      a.component === component &&
      (!activity || a.activity === activity) &&
      (!milestone || a.milestone === milestone),
  );
}

export function scopedRows(
  component: string,
  activity: string | null = null,
  milestone: string | null = null,
  cutoff = currentSnapshot().seq,
) {
  return currentGoal()
    .logs.filter(
      ([, owner, step, id, row]) =>
        owner === component &&
        (!activity || activity === step) &&
        (!milestone || id === milestone) &&
        Number(row[4]) <= cutoff,
    )
    .map(([, , , , row]) => row);
}

export function measuredScope(
  activations: Activation[],
  statusText: string,
  at: string | null = null,
): Stats {
  const reported = activations.filter((a) => a.input !== null && a.output !== null);
  const completed = activations.filter((a) => a.ms !== null);
  return {
    state: statusText,
    last: localDate(at || activations.at(-1)?.end || activations.at(-1)?.at),
    nativeDuration: measuredDuration(
      completed.length ? completed.reduce((n, a) => n + (a.ms ?? 0), 0) : null,
    ),
    input: reported.length ? reported.reduce((n, a) => n + (a.input ?? 0), 0) : null,
    output: reported.length ? reported.reduce((n, a) => n + (a.output ?? 0), 0) : null,
    cached:
      reported.length && reported.every((a) => a.cached != null)
        ? reported.reduce((n, a) => n + (a.cached ?? 0), 0)
        : null,
    reported: reported.length,
    activations: activations.length,
  };
}

export function currentReview() {
  return currentGoal().review.findLast((v) => v.seq <= currentSnapshot().seq);
}
