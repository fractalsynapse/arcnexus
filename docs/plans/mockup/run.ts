import { data, state } from './model.ts';
import type {
  Activation,
  PlanStep,
  Milestone,
  Review,
  RunRevision,
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
import { countDetails, metrics, eventLog } from './timeline.ts';
import {
  tokenCount,
  asText,
  githubReferences,
  tokenPair,
  cacheRate,
  outcomeName,
  roundStatus,
  noData,
  escape,
  factList,
  button,
  pill,
  status,
  options,
  panel,
  title,
  breadcrumbs,
  tabs,
  readouts,
  patchLines,
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

export function reviewAction() {
  const review = currentReview();
  if (!review) return status('No verdict recorded');
  const approved = review.kind === 'accepted';
  if (approved) return status('Approved');
  const next = review.action;
  return (
    status(outcomeName(review.kind)) +
    (next && next.milestones.length
      ? '<p><strong>Next step recorded</strong> · Direction scheduled ' +
        next.milestones
          .map(([owner, id]) => '<code>' + escape(owner + ' / ' + id) + '</code>')
          .join(', ') +
        '.</p>'
      : noData('A subsequent correction plan is unavailable in this record.'))
  );
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
  const link = number
    ? githubReferences((issue ? 'Issue' : 'PR') + ' #' + number)
    : noData(issue ? 'No issue linked to this assessment.' : 'No PR observed for this revision.');
  return `<div class="arc-issue">
    ${compact ? `<small>${label}</small>` : ''}
    ${link}${!issue && number ? status(delivered ? 'Merged' : 'Hosted check failed') : ''}
    ${!compact && delivered && !issue ? `<small>Staging commit · <code>${escape(delivery.commit)}</code></small>` : ''}
  </div>`;
}

export function runIndex() {
  const goal = currentGoal();
  const snapshot = currentSnapshot();
  return (
    title('Run', goal.title) +
    roundStatus() +
    '<div class="arc-detail-toolbar">' +
    goalControl() +
    revisionControl() +
    '</div>' +
    '<div class="arc-stages">' +
    stage('Direction', '/run/direction/', strategy(true)) +
    stage('Work', '/run/component/focus/', assignments(true), false) +
    stage('Review', '/run/review/', reviewContent(true) + reviewAction()) +
    stage('Delivery', '/run/delivery/', issueView('issue', true) + issueView('pr', true)) +
    '</div>' +
    roundEvidence(snapshot)
  );
}

export function roundEvidence(snapshot: RunRevision) {
  const r = data.round;
  const usage = r.usage;
  const tools = data.toolUsage;
  const providerOnly = tools.provider - tools.host;
  const report = Object.entries({
    ...tools.names,
    'read-file': (tools.names['read-file'] ?? 0) + providerOnly,
  }).sort((a, b) => b[1] - a[1]);
  return panel(
    'Round evidence',
    readouts([
      ['Wall time', r.wall],
      ['Model messages', tokenCount(tools.messages)],
      ['Tool calls', tokenCount(tools.provider)],
      ['Reported tokens (in / out)', tokenPair(usage.input_tokens, usage.output_tokens)],
      ['Token cache rate', cacheRate(usage.input_tokens, usage.cached_input_tokens)],
      ['Usage coverage', r.coverage.withReportedUsage + ' / ' + r.coverage.activations],
    ]) +
      countDetails({ report, providerOnly }) +
      evidenceNotes(),
    `<small>Run ${snapshot.run}</small>`,
  );
}

function evidenceNotes() {
  const r = data.round;
  const notes = [
    'Round 1 completed after two controlled interruptions. It was excluded from qualification because it received operator-assisted regression evidence.',
    'Eight goals assessed, with six staging merges and two satisfied by evidence.',
    'Native time ' +
      r.native +
      '. Cached input is included in reported input. Two interrupted activations have no reported usage.',
    'Cost unavailable. The evidence has no verified pricing or billing basis.',
    'Stable milestone and activation IDs would make operation attribution explicit.',
    'Review next steps come from the subsequent plan. A verdict-to-action link would make that association explicit.',
    'File dates and revisions come from Git. Topics are unavailable in captured file metadata.',
    r.following,
  ];
  return `<details><summary>Evidence coverage and gaps</summary>${factList(notes)}</details>`;
}

export function sectionDetail(phase: string) {
  const direction = phase === 'Direction';
  const actor = direction ? 'Director' : 'Reviewer';
  const path = direction ? '/run/direction/' : '/run/review/';
  const component = direction ? 'direction' : 'reviewer';
  const activity = direction ? 'planning' : 'assessment';
  const snapshot = currentSnapshot();
  const review = currentReview();
  const stats = measuredScope(
    scopedActs(component, activity),
    direction ? 'Assessed' : outcomeName(review?.kind),
    review?.at,
  );
  const body = direction
    ? `<div class="arc-grid equal">${panel('Strategy', strategy())}
    ${panel('Component assignments', assignments(), '', false)}</div>`
    : panel('Review', reviewContent()) + panel('Action', reviewAction());
  return (
    breadcrumbs([['Run', '/run/'], [phase]]) +
    title(phase, currentGoal().title) +
    `<div class="arc-detail-toolbar">${revisionControl()}${button('View log', path + 'log/', 'list')}</div>
    ${body}
    ${metrics(actor, stats, scopedRows(component, activity))}
    <small class="arc-mono">Run ${snapshot.run} · Captured staging ${asText(snapshot.capturedRevision)}</small>`
  );
}

export function actorLog(phase: string) {
  const direction = phase === 'Direction';
  const actor = direction ? 'Director' : 'Reviewer';
  const component = direction ? 'direction' : 'reviewer';
  const activity = direction ? 'planning' : 'assessment';
  const path = direction ? '/run/direction/' : '/run/review/';
  const review = currentReview();
  const stats = measuredScope(
    scopedActs(component, activity),
    direction ? 'Assessed' : outcomeName(review?.kind),
  );
  return (
    breadcrumbs([['Run', '/run/'], [phase, path], ['Log']]) +
    title(actor + ' log', currentGoal().title) +
    '<div class="arc-detail-toolbar">' +
    revisionControl() +
    '</div>' +
    metrics(actor, stats, scopedRows(component, activity)) +
    eventLog(actor, scopedRows(component, activity))
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
  milestone: string | null = null,
  activity: string | null = null,
) {
  const entries = scopedReceipts(component, milestone, activity);
  const heading = `<small>${escape(label)}</small>`;
  if (!entries.length)
    return panel('File diff', noData('No checked edits in the selected scope.'), heading);
  const paths = [...new Set(entries.map((r) => r.path))];
  const last = entries.findLast((r) => r.excerpt);
  const patch = last?.excerpt
    ? patchDetails(
        last.truncated ? 'Latest checkpoint patch excerpt' : 'Latest checkpoint patch',
        last.path,
        last.excerpt,
      )
    : noData('Checkpoint patch text is unavailable for this scope.');
  return panel(
    'File diff',
    `<p>${paths.length} changed ${paths.length === 1 ? 'file' : 'files'} · ${entries.length} checked edit receipts</p>
    <details><summary>Changed paths</summary>${factList(paths)}</details>${patch}`,
    heading,
  );
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
    : panel('Activity list', workActivities(milestone), '', false) +
      scopedDiff('Component updates', component);
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
    `<div class="arc-grid equal">
      ${panel('File ownership', files, pill('Scoped write'))}
      ${panel('File access', noData('Source and evidence access follow the selected activity’s mapped operations.'), pill('Read only', 'quiet'))}
    </div>`
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
  const context = `<p>Goal · ${escape(currentGoal().title)}</p><p>Capture · <code>${asText(captured)}</code></p>
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
  const activations = scopedActs(component, activity, milestone.id);
  const result = stepState(milestone, step, milestone.steps.indexOf(step));
  const rows = scopedRows(component, activity, milestone.id);
  const body = focus
    ? focusActivity(step, activations.at(-1), row.activities[activity])
    : metrics('Activity', measuredScope(activations, result), rows) +
      eventLog('Activity', rows) +
      scopedDiff('Activity updates', component, milestone.id, activity);
  return (
    activityHeader(component, activity, milestone.id, result) +
    tabs(focus, true, '/run/activity/') +
    body
  );
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
  return (
    breadcrumbs([['Run', '/run/'], ['Delivery']]) +
    title('Delivery', goal.title) +
    `<div class="arc-detail-toolbar">${revisionControl()}</div>` +
    panel('Delivery state', deliveryState(goal, delivered), status(outcomeName(snap.kind))) +
    `<div class="arc-grid equal">${panel('GitHub issue', issueView('issue'))}${panel('GitHub PR', issueView('pr'))}</div>` +
    history +
    deliveryDiff(d, delivered)
  );
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
  return `<p>Verified on staging at <code>${escape(d.commit)}</code>.</p>
    <small>Reviewed tree <code>${asText(source?.candidate)}</code> · Parent <code>${asText(source?.parent)}</code> · Branch <code>${escape(source?.branch)}</code></small>`;
}

function deliveryDiff(d: Goal['delivery'], delivered: boolean) {
  if (!delivered || !d.patch)
    return panel('File diff', noData('No confirmed PR diff at this revision.'));
  return panel(
    'File diff',
    `<details><summary>${d.files.length} changed files</summary>
    ${factList(d.files.map(([change, path]) => change + ' · ' + path))}</details>
    ${patchDetails(d.patchExcerpt ? 'Patch excerpt' : 'Patch', d.patchPath ?? '', d.patch)}`,
    '<small>Staging merge</small>',
  );
}

function patchDetails(label: string, path: string, patch: string) {
  const contents = patchLines(patch)
    .map(([kind, line]) => `<span class="${kind}">${escape(line)}</span>`)
    .join('');
  return `<details><summary>${label} · <code>${escape(path)}</code></summary>
    <pre class="arc-diff">${contents}</pre></details>`;
}
