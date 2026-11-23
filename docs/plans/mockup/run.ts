import { state } from './model.ts';
import { diffView, readPatch } from './diff.ts';
import { overview, splitPanels, standalonePane } from './panels.ts';
import type {
  Activation,
  PlanStep,
  Milestone,
  Review,
  Goal,
  ComponentModel,
  ActivityModel,
} from './model.ts';
import {
  currentGoal,
  currentSnapshot,
  currentPlan,
  goalControl,
  revisionControl,
  stage,
  strategy,
  stepState,
  assignments,
  currentMilestone,
  stepName,
  workActivities,
  scopedActs,
  scopedRows,
  measuredScope,
  currentReview,
} from './run-context.ts';
import { metrics, eventLogPane } from './timeline.ts';
import {
  asText,
  commitReference,
  githubReferences,
  githubOutcome,
  outcomeName,
  roundStatus,
  noData,
  escape,
  factList,
  button,
  icon,
  pill,
  status,
  options,
  panel,
  title,
  breadcrumbs,
  tabs,
} from './view.ts';

export function reviewContent(compact = false) {
  const review = currentReview();
  if (!review) return noData('No independent verdict recorded at this revision.');
  const meta = `<small class="arc-mono">Run ${review.run} · Tree ${asText(review.candidate)}</small>`;
  const checks = compact ? '' : candidateChecks(review);
  if (review.kind === 'accepted') {
    const criteria = compact
      ? ''
      : `<details><summary>Accepted criteria</summary>${factList(review.criteria)}</details>`;
    return `<h3>${review.criteria.length} criteria accepted</h3>${meta}${criteria}${checks}`;
  }
  const findings = compact ? review.findings.slice(0, 1) : review.findings;
  return meta + findings.map((f) => findingView(f, compact)).join('') + checks;
}

function findingView(f: Review['findings'][number], compact: boolean) {
  const evidence =
    compact || !f.evidence.length
      ? ''
      : `<details><summary>Evidence references</summary>${factList(f.evidence)}</details>`;
  return `<div class="arc-finding">
    <h3>${escape(f.criterion)}</h3><small>Owner · ${escape(f.owner)}</small>
    <p>${escape(f.reason)}</p>${evidence}
  </div>`;
}

export function candidateChecks(review: Review) {
  if (!review.checks.length)
    return noData('No separate required check record joined to this verdict.');
  return (
    '<details><summary>Required check observations</summary><ul class="arc-facts">' +
    review.checks
      .map(
        ([name, exit]) =>
          '<li><code>' +
          escape(name) +
          '</code> · ' +
          (exit === null ? 'Unavailable' : 'Exit ' + escape(exit)) +
          '</li>',
      )
      .join('') +
    '</ul></details>'
  );
}

export function reviewAction(compact = false) {
  const review = currentReview();
  if (!review) return status('No verdict recorded');
  const approved = review.kind === 'accepted';
  if (approved) return status('Approved');
  const next = review.action;
  const scheduled = next?.milestones.length;
  return (
    status(outcomeName(review.kind)) +
    `<h3>${scheduled ? 'Sent to Direction' : 'Direction handles correction'}</h3>` +
    (scheduled
      ? '<p>Direction scheduled ' +
        next.milestones
          .map(([owner, id]) => '<code>' + escape(owner + ' / ' + id) + '</code>')
          .join(', ') +
        '.</p>'
      : noData('No correction plan recorded for this verdict.')) +
    (compact ? '' : directionLink())
  );
}

function directionLink() {
  return `<div>${button('Open Direction', '/run/direction/', 'arrow-up-right')}</div>`;
}

export function issueView(kind: string, compact = false) {
  const goal = currentGoal();
  const delivery = goal.delivery;
  const issue = kind === 'issue';
  const snapshot = currentSnapshot();
  const delivered = snapshot.kind === 'merged';
  const pr = delivered
    ? delivery.pr
    : goal.hostedFailures.findLast((row) => row.seq <= snapshot.seq)?.pr;
  const number = issue ? delivery.issue : pr?.split('/').at(-1);
  const label = issue ? 'GitHub issue' : 'Staging PR';
  const observedState = issue ? delivery.issueState : delivered ? 'merged' : 'hosted check failed';
  const count = issue ? delivery.issueComments : delivered ? delivery.prCommits : undefined;
  const link = number
    ? githubOutcome(issue ? 'Issue' : 'PR', number, observedState, count)
    : noData(issue ? 'No issue linked to this assessment.' : 'No PR observed for this revision.');
  return `<div class="arc-issue">
    ${compact ? `<small>${label}</small>` : ''}
    ${link}
    ${!compact && delivered && !issue ? `<small>Staging commit · <code>${commitReference(delivery.commit)}</code></small>` : ''}
  </div>`;
}

export function runIndex() {
  const goal = currentGoal();
  return (
    title('Run', goal.title, roundStatus()) +
    '<div class="arc-detail-toolbar">' +
    goalControl() +
    revisionControl() +
    '</div>' +
    '<div class="arc-stages">' +
    stage('Direction', '/run/direction/', strategy(true)) +
    stage('Work', '/run/component/focus/', assignments(true), false) +
    stage('Review', '/run/review/', reviewContent(true) + reviewAction(true)) +
    stage('Delivery', '/run/delivery/', issueView('issue', true) + issueView('pr', true)) +
    '</div>'
  );
}

function actorEvidence(phase: 'Direction' | 'Review') {
  const direction = phase === 'Direction';
  const actor = direction ? 'Director' : 'Reviewer';
  const path = direction ? '/run/direction/' : '/run/review/';
  const component = direction ? 'direction' : 'reviewer';
  const activity = direction ? 'planning' : 'assessment';
  const review = direction ? undefined : currentReview();
  const stats = measuredScope(
    scopedActs(component, activity),
    direction ? 'Assessed' : outcomeName(review?.kind),
    review?.at,
  );
  return { actor, path, stats, rows: scopedRows(component, activity) };
}

export function sectionDetail(phase: 'Direction' | 'Review') {
  const direction = phase === 'Direction';
  const { actor, path, stats, rows } = actorEvidence(phase);
  const outcome = direction ? panel('Strategy', strategy()) : panel('Review', reviewContent());
  const context = direction
    ? {
        id: 'arc-component-assignments',
        label: 'Component assignments',
        content: (action: string) => panel('Component assignments', assignments(), action, false),
      }
    : panel('Action on review', reviewAction());
  const snapshot = currentSnapshot();
  return (
    breadcrumbs([['Run', '/run/'], [phase]]) +
    title(phase, currentGoal().title) +
    `<div class="arc-detail-toolbar">${revisionControl()}${button('View log', path + 'log/', 'list')}</div>` +
    overview(metrics(actor, stats, rows), outcome, { context }) +
    `<small class="arc-mono">Run ${snapshot.run} · Captured staging ${commitReference(snapshot.capturedRevision, asText(snapshot.capturedRevision))}</small>`
  );
}

export function actorLog(phase: 'Direction' | 'Review') {
  const { actor, path, stats, rows } = actorEvidence(phase);
  return (
    breadcrumbs([['Run', '/run/'], [phase, path], ['Log']]) +
    title(actor + ' log', currentGoal().title) +
    '<div class="arc-detail-toolbar">' +
    revisionControl() +
    '</div>' +
    standalonePane(eventLogPane(actor, rows), { before: metrics(actor, stats, rows) })
  );
}

export function selectDefaultComponent() {
  const list = currentPlan()?.milestones || [];
  if (!list.some((m) => m.owner === state.component)) {
    state.component = list[0]?.owner ?? '';
    state.milestone = '';
  }
}

export function milestoneControl(component: string) {
  const list = currentPlan()?.milestones.filter((m) => m.owner === component) || [];
  if (list.length <= 1) return '';
  return (
    '<label>Milestone<select data-change="milestone">' +
    options(
      list.map((m) => [m.id, m.id.replaceAll('-', ' ')]),
      currentMilestone()?.id,
    ) +
    '</select></label>'
  );
}

export function scopedDiff(
  label: string,
  component: string,
  { milestone = null, activity = null, action = '' }: {
    milestone?: string | null; activity?: string | null; action?: string;
  } = {},
) {
  const entries = scopedReceipts(component, milestone, activity);
  if (!entries.length)
    return panel('Changes', noData('No checked edits in the selected scope.'), action);
  const paths = new Map<string, typeof entries[number]>();
  for (const entry of entries) {
    if (entry.excerpt || !paths.has(entry.path)) paths.set(entry.path, entry);
  }
  return diffView(label + ' · ' + entries.length + ' checked edit receipts', [...paths.values()].map((entry) => ({
    path: entry.path,
    lines: entry.excerpt ? readPatch(entry.excerpt, entry.path).find((file) => file.path === entry.path)?.lines ?? [] : [],
    note: entry.truncated ? 'Latest retained checkpoint patch excerpt' :
      entry.excerpt ? 'Latest retained checkpoint patch' : 'No patch text retained for this path.',
  })), { localPatch: true, action });
}

function scopedReceipts(owner: string, milestone: string | null, activity: string | null) {
  const cutoff = currentSnapshot().seq;
  return currentGoal().receipts.filter(
    (receipt) =>
      receipt.seq <= cutoff &&
      receipt.owner === owner &&
      (!milestone || receipt.milestone === milestone) &&
      (!activity || receipt.activity === activity),
  );
}

export function compPage(focus: boolean) {
  selectDefaultComponent();
  const component = state.component;
  const row = currentGoal().components[component];
  const milestone = currentMilestone();
  if (!row || !milestone)
    return (
      breadcrumbs([['Run', '/run/'], ['Work']]) +
      title('Component steward') +
      panel('Assignments', noData('No steward activity was needed for this goal.'))
    );
  const body = focus
    ? componentFocus(row, milestone)
    : splitPanels({
      id: 'arc-component-activities',
      label: 'Activity list',
      content: (action) => panel('Activity list', workActivities(milestone), action, false),
    }, {
      id: 'arc-component-changes',
      label: 'Changes',
      content: (action) => scopedDiff('Component updates', component, { action }),
    });
  return (
    breadcrumbs([['Run', '/run/'], ['Direction', '/run/direction/'], [component]]) +
    title(component, 'Component steward · ' + milestone.id.replaceAll('-', ' ')) +
    `<div class="arc-detail-toolbar">${revisionControl()}${milestoneControl(component)}${button('Director', '/run/direction/', 'arrow-left')}</div>` +
    tabs(focus, false, '/run/component/') +
    body
  );
}

function componentFocus(row: ComponentModel, milestone: Milestone) {
  const criteria = factList(milestone.criteria.map((c) => c.id + ' · ' + c.description));
  const purpose = row.purpose.replace(/^#.*\n*/, '') || 'Captured in component specification.';
  const files =
    row.owns.map((path) => `<code>${escape(path)}</code>`).join('') ||
    noData('No owned paths declared.');
  return (
    panel('Instructions from Director', criteria) +
    panel('Component purpose', `<p>${escape(purpose)}</p>`) +
    splitPanels({
      id: 'arc-file-ownership',
      label: 'File ownership',
      content: (action) => panel('File ownership', files, `<div class="arc-row">${pill('Scoped write')}${action}</div>`),
    }, {
      id: 'arc-file-access',
      label: 'File access',
      content: (action) => panel('File access', noData('Source and evidence access follow the selected activity’s mapped operations.'), `<div class="arc-row">${pill('Read only', 'quiet')}${action}</div>`),
    })
  );
}

function focusActivity(
  step: PlanStep,
  mostRecent: Activation | undefined,
  mapping: ActivityModel | undefined,
) {
  const instructions = step.inapplicable
    ? noData(step.inapplicable)
    : factList(step.checklist.map((c) => c.id + ' · ' + c.expected));
  const profile =
    mostRecent || mapping
      ? `<h3>${escape(mostRecent?.profile || mapping?.profile || 'Host activity')}</h3>
    <p>Role · ${escape(mapping?.role || 'Unavailable')}</p>
    <p>Model · ${escape(mostRecent?.model || 'Unavailable')}</p>
    <small>Reasoning · ${escape(mostRecent?.reasoning || 'Unavailable')}</small>`
      : noData('No activation profile available.');
  const captured = mostRecent?.revision || currentSnapshot().capturedRevision;
  const context = `<p>Goal · ${escape(currentGoal().title)}</p><p>Capture · <code>${commitReference(captured, asText(captured))}</code></p>
    <small>Mapped operations</small>
    <div class="arc-chips">${(mapping?.operations ?? []).map((op) => pill(op, 'quiet')).join('')}</div>`;
  return (
    panel('Instructions from Director', instructions) +
    `<div class="arc-grid equal">${panel('Activity profile', profile)}${panel('Activity context', context)}</div>`
  );
}

export function activityPage(focus: boolean) {
  selectDefaultComponent();
  const { component, activity } = state;
  const milestone = currentMilestone();
  const step = milestone?.steps.find((entry) => entry.activity === activity);
  const row = currentGoal().components[component];
  if (!step || !row || !milestone) return unassignedActivity();
  const result = stepState(milestone, step, milestone.steps.indexOf(step));
  const body = focus
    ? focusActivity(step, scopedActs(component, activity, milestone.id).at(-1), row.activities[activity])
    : activityEvidence(component, activity, milestone.id, result);
  return (
    activityHeader(component, activity, milestone.id, result) +
    tabs(focus, true, '/run/activity/') +
    milestoneRepairPanel(milestone, activity) +
    body
  );
}

const milestoneRepairExamples = [
  {
    activity: 'review',
    sender: 'Milestone Review',
    subject: 'Add coverage for the staging conflict case',
    evidence:
      'Review finding · The regression test covers the normal merge and misses the conflict case in the milestone criteria.',
  },
  {
    activity: 'release',
    sender: 'Milestone Release',
    subject: 'Investigate the owner test failure after merging staging',
    evidence:
      'Staging integration check · Owner tests exited 1 on the merged candidate. Review the failing assertion before retrying the integration check.',
  },
];

function milestoneRepairPanel(milestone: Milestone, activity: string) {
  const activities = milestone.steps.filter((step) => !step.inapplicable).map((step) => step.activity);
  const target = activities.indexOf('testing');
  if (target < 0) return '';
  const examples = milestoneRepairExamples.filter(
    (example) => activities.indexOf(example.activity) > target,
  );
  const preview = pill('Routing preview', 'quiet');
  if (activity === 'testing' && examples.length) {
    const messages = examples.map((example) => `<details>
      <summary>${escape(example.subject)}</summary>
      <p><strong>${escape(example.sender)}</strong></p>
      <p>${escape(example.evidence)}</p></details>`);
    return panel('Steward inbox', messages.join(''), preview);
  }
  const example = examples.find((entry) => entry.activity === activity);
  if (!example) return '';
  const title = activity === 'review' ? 'Action on review' : 'Action on release';
  const content = `
    <h3>Returned to Testing</h3>
    <small>From ${escape(example.sender)} · To <strong>${escape(milestone.owner)} steward inbox</strong></small>
    <p>${escape(example.subject)}</p>
    <details><summary>Failure evidence</summary><p>${escape(example.evidence)}</p></details>
    <div><button type="button" class="arc-button" data-activity="testing">${icon('inbox')}Open Testing inbox</button></div>`;
  return panel(title, content, preview);
}

function activityEvidence(component: string, activity: string, milestone: string, result: string) {
  const rows = scopedRows(component, activity, milestone);
  const statistics = metrics('Activity', measuredScope(scopedActs(component, activity, milestone), result), rows);
  return statistics + splitPanels(eventLogPane('Activity', rows), {
    id: 'arc-activity-changes',
    label: 'Changes',
    content: (action) => scopedDiff('Activity updates', component, { milestone, activity, action }),
  });
}

function unassignedActivity() {
  return (
    breadcrumbs([['Run', '/run/'], ['Activities']]) +
    title('Activity') +
    panel('Activity', noData('Open an assigned activity from the component view.'))
  );
}

function activityHeader(component: string, activity: string, milestone: string, result: string) {
  return (
    breadcrumbs([
      ['Run', '/run/'],
      [component, '/run/component/activities/'],
      [stepName(activity)],
    ]) +
    title(stepName(activity), component + ' · ' + milestone.replaceAll('-', ' '), status(result)) +
    `<div class="arc-detail-toolbar">${revisionControl()}${button('Component', '/run/component/activities/', 'arrow-left')}</div>`
  );
}

export function deliveryPage() {
  const goal = currentGoal(),
    d = goal.delivery,
    snap = currentSnapshot();
  const delivered = snap.kind === 'merged';
  const notes = goal.hostedFailures.filter((row) => row.seq <= snap.seq);
  const history = notes.length
    ? panel(
        'Hosted check history',
        notes.map((n) => `<p>${githubReferences(n.diagnostic)}</p>`).join(''),
      )
    : '';
  const releaseRouting = releaseAction(notes.length > 0);
  return (
    breadcrumbs([['Run', '/run/'], ['Delivery']]) +
    title('Delivery', goal.title) +
    `<div class="arc-detail-toolbar">${revisionControl()}</div>` +
    splitPanels({
      id: 'arc-delivery-outcome',
      label: 'Delivery state',
      content: (action) => `<div class="arc-stack">
        ${panel('Delivery state', deliveryState(goal, delivered), `<div class="arc-row">${status(outcomeName(snap.kind))}${action}</div>`)}
        ${panel('GitHub issue', issueView('issue'))}${panel('GitHub PR', issueView('pr'))}${releaseRouting}${history}</div>`,
    }, {
      id: 'arc-delivery-changes',
      label: 'Changes',
      content: (action) => deliveryDiff(d, delivered, action),
    })
  );
}

function releaseAction(hasHostedFailure: boolean) {
  const next = `<p>Direction receives the candidate identity and failure evidence, then assigns the correction. The corrected candidate returns through the required review and checks.</p>${directionLink()}`;
  const content = hasHostedFailure
    ? `<h3>Route to Direction</h3>${next}`
    : `<details><summary>If final release needs an engineering correction</summary><p><strong>Route to Direction</strong></p>${next}</details>`;
  return panel('Action on release', content, pill('Routing preview', 'quiet'));
}

function deliveryState(goal: Goal, delivered: boolean) {
  const d = goal.delivery;
  const source = d.publication;
  if (!delivered)
    return noData(
      goal.outcome.kind === 'satisfied'
        ? 'Goal satisfied without a staging change.'
        : 'No verified merge recorded at this revision.',
    );
  return `<p>Verified on staging at <code>${commitReference(d.commit)}</code>.</p>
    <small>Reviewed tree <code>${asText(source?.candidate)}</code> · Parent <code>${commitReference(source?.parent, asText(source?.parent))}</code> · Branch <code>${escape(source?.branch)}</code></small>`;
}

function deliveryDiff(d: Goal['delivery'], delivered: boolean, action: string) {
  if (!delivered || !d.files.length)
    return panel('Changes', noData('No confirmed PR diff at this revision.'), action);
  const patches = new Map(readPatch(d.patch ?? '', d.patchPath).map((file) => [file.path, file]));
  return diffView('Staging merge', d.files.map(([, path]) => {
    const file = patches.get(path);
    return {
      path,
      lines: file?.lines ?? [],
      note: !file ? 'Open the local merge patch to inspect this path.' :
        d.patchExcerpt ? 'Retained patch excerpt' : undefined,
    };
  }), { localPatch: true, action });
}
