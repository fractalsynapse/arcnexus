import { diffBody, diffView } from './diff.ts';
import type { FileDelta } from './diff.ts';
import type { ReleaseCheck } from './model.ts';
import { exampleLabel } from './ogsm.ts';
import {
  productionCandidate as candidate,
  productionPreview,
  releaseScenarios,
} from './production-preview.ts';
import { releaseChecks, releaseEvidenceRow } from './release-evidence.ts';
import {
  breadcrumbs,
  button,
  escape,
  noData,
  options,
  panel,
  readouts,
  status,
  title,
} from './view.ts';

type Preview = NonNullable<ReturnType<typeof productionPreview>>;

const specialistEvidence: ReleaseCheck[] = [
  {
    name: 'Performance',
    state: 'passed',
    detail: 'Planner comparisons confirmed fewer discovery calls on the reviewed candidate.',
  },
  {
    name: 'Security',
    state: 'passed',
    detail: 'Production package contents matched the approved inventory.',
  },
  {
    name: 'Pluggability',
    state: 'passed',
    detail: 'Planner operation bindings passed the integration checks.',
  },
  {
    name: 'Pre-release checks',
    state: 'passed',
    detail: 'Required provider checks and external review passed for the illustrated PR head.',
  },
];
const rejection =
  'The package includes a development-only configuration file. Remove it and verify the package contents on staging.';
const cliFailure = 'The released CLI exited with code 1 before reporting its version.';
const artifacts = [
  { name: 'npm package', id: 'arcnexus@0.4.0-example', check: 'Published package install' },
  { name: 'CLI binary', id: 'example-cli-artifact-b', check: 'Binary startup smoke check' },
] as const;
const changes: FileDelta[] = [
  {
    path: 'packages/planner/src/index.ts',
    lines: [
      ['hunk', '@@ Planner file discovery'],
      ['removed', '− const paths = await scanOwnedFiles(scope);'],
      ['added', '+ const paths = await fileInventory.read(scope);'],
    ],
  },
];

function specialistResults(rejected: boolean) {
  return releaseChecks(
    specialistEvidence.map((check) =>
      rejected && check.name === 'Security'
        ? { ...check, state: 'failed', detail: rejection }
        : check,
    ),
  );
}

export function productionReleasePanel() {
  const preview = productionPreview();
  if (!preview) return '';
  const chooser = `<label><span id="release-scenario-label">Release scenario</span>
    <select data-change="production-scenario" aria-labelledby="release-scenario-label">${options(Object.entries(releaseScenarios), preview.scenario)}</select></label>`;
  return `<div id="arc-production-release" tabindex="-1">${panel(
    'Production release',
    chooser +
      `<ol class="arc-release-stages">${productionStages(preview)}</ol>` +
      productionAction(preview),
    `<div class="arc-row"><code>${escape(candidate.staging)}</code>${status(preview.status)}</div>`,
  )}</div>`;
}

function productionStages(preview: Preview) {
  const { phase, reached } = preview;
  const approval = approvalStatus(preview);
  const merge = reached('published')
    ? 'Published'
    : reached('tagged')
      ? 'Tagged'
      : reached('merged')
        ? 'Merged'
        : 'Pending';
  const checks =
    phase === 'failed'
      ? 'Failed'
      : phase === 'delivered'
        ? 'Passed'
        : phase === 'published'
          ? 'Running'
          : 'Pending';
  return (
    specialistStage(phase) +
    releaseEvidenceRow('Final approval', approval, approvalEvidence(approval)) +
    releaseEvidenceRow('Merge, tag and publish', merge, publicationEvidence(preview)) +
    releaseEvidenceRow('Post-release checks', checks, postReleaseEvidence(preview))
  );
}

function specialistStage(phase: Preview['phase']) {
  const reviewed = phase !== 'ready';
  const rejected = phase === 'rejected';
  const body = reviewed
    ? specialistResults(rejected)
    : noData('Specialist verdicts and required checks will appear here.');
  const diff = `<details><summary>Candidate changes</summary>${diffBody(changes)}</details>`;
  return releaseEvidenceRow(
    'Specialist reviews and pre-release checks',
    rejected ? 'Changes requested' : reviewed ? 'Passed' : 'Pending',
    body + diff,
  );
}

function approvalStatus({ phase, reached }: Preview) {
  if (reached('approved')) return 'Approved';
  if (phase === 'review') return 'Awaiting decision';
  if (phase === 'held') return 'On hold';
  if (phase === 'changes-requested') return 'Changes requested';
  return 'Pending';
}

function approvalEvidence(approval: string) {
  return approval === 'Approved'
    ? readouts([
        ['Decision', 'Approve release'],
        ['Approved PR head', escape(candidate.head)],
        ['Approved tag', escape(candidate.tag)],
      ])
    : noData('Approval binds the production PR head, main base, tag and release scope.');
}

function publicationEvidence({ reached }: Preview) {
  return readouts(
    [
      ['Main merge commit', reached('merged') ? escape(candidate.merge) : 'Pending'],
      ['Tag', reached('tagged') ? escape(candidate.tag) : 'Pending'],
      [
        'Published artifacts',
        reached('published')
          ? artifacts.map(({ id }) => `<code>${escape(id)}</code>`).join('<br>')
          : 'Pending',
      ],
    ],
    'arc-release-revisions',
  );
}

function postReleaseEvidence({ phase, reached }: Preview) {
  if (!reached('published')) return noData('Checks run against the published artifacts.');
  return artifacts
    .map(({ name, id, check }) => {
      const failed = phase === 'failed' && name === 'CLI binary';
      const state = phase === 'published' ? 'pending' : failed ? 'failed' : 'passed';
      const detail =
        state === 'pending'
          ? 'Waiting for production evidence.'
          : failed
            ? cliFailure
            : 'The production check passed for this artifact.';
      return `<h3>${escape(name)}</h3><code>${escape(id)}</code>${releaseChecks([{ name: check, state, detail }])}`;
    })
    .join('');
}

function actionButton(action: string, label: string, style = 'solid') {
  return `<button type="button" class="arc-button ${escape(style)}" data-action="${escape(action)}">${escape(label)}</button>`;
}

function productionAction({ phase, action }: Preview) {
  if (phase === 'ready')
    return `<div>${actionButton('production-reviews', 'Run specialist reviews')}</div>`;
  if (phase === 'review')
    return `<div>${button('Review release', '/release/approval/', 'arrow-up-right', 'arc-button solid')}</div>`;
  if (phase === 'rejected' || phase === 'changes-requested')
    return '<div class="arc-finding"><h3>Route to Direction</h3><p>Correct the finding on staging and verify a new candidate.</p></div>';
  if (phase === 'failed')
    return `<div class="arc-row">${status('Production outage')}${button('Open incident task', '/run/incident/', 'arrow-up-right')}</div>`;
  if (phase === 'published')
    return `<div>${actionButton('production-checks', 'Run post-release checks')}</div>`;
  return action ? `<div>${actionButton(...action)}</div>` : '';
}

export function productionApprovalPage() {
  const heading =
    breadcrumbs([['Release', '/release/'], ['Final approval']]) +
    title('Production release approval', '', exampleLabel());
  if (productionPreview()?.phase !== 'review')
    return (
      heading +
      panel(
        'Final approval',
        noData('Approval is available after required reviews and checks pass.'),
      )
    );
  return (
    heading +
    panel('Exact release candidate', approvalCandidate()) +
    candidateDiff() +
    panel('Review evidence', specialistResults(false)) +
    panel(
      'Decision',
      `<div class="arc-row">
      ${actionButton('production-approve', 'Approve release')}
      ${actionButton('production-hold', 'Hold', '')}
      ${actionButton('production-request-changes', 'Request changes', '')}</div>`,
    )
  );
}

function approvalCandidate() {
  return readouts(
    [
      ['Production PR', escape(candidate.pr)],
      ['PR head', `<code>${escape(candidate.head)}</code>`],
      ['Candidate tree', `<code>${escape(candidate.tree)}</code>`],
      ['Main base', `<code>${escape(candidate.base)}</code>`],
      ['Source staging revision', `<code>${escape(candidate.staging)}</code>`],
      ['Included PRs', escape(candidate.included)],
      ['Proposed tag', `<code>${escape(candidate.tag)}</code>`],
      ['Deliverables', artifacts.map(({ name }) => escape(name)).join(', ')],
    ],
    'arc-release-revisions',
  );
}

function candidateDiff() {
  return diffView('Illustrative production PR', changes, { heading: 'Candidate changes' });
}

export function productionIncidentPage() {
  const heading =
    breadcrumbs([['Run', '/run/'], ['Incident task']]) +
    title('Production incident task', 'Restore startup for the released CLI', exampleLabel());
  const back = `<div>${button('Back to release', '/release/', 'arrow-left')}</div>`;
  if (productionPreview()?.phase !== 'failed')
    return heading + noData('No production incident is recorded in this example.') + back;
  const scope = readouts(
    [
      ['Incident task', `<code>${escape(candidate.incident)}</code>`],
      ['Priority', status('Production outage')],
      ['Assigned to', 'Direction'],
      ['Original goal', escape(candidate.goal)],
      ['Affected deliverable', 'CLI binary'],
      ['Published artifact', `<code>${escape(artifacts[1].id)}</code>`],
      ['Production tag', `<code>${escape(candidate.tag)}</code>`],
      ['Main merge commit', `<code>${escape(candidate.merge)}</code>`],
    ],
    'arc-release-revisions',
  );
  const evidence = releaseChecks([
    { name: artifacts[1].check, state: 'failed', detail: cliFailure },
  ]);
  return (
    heading +
    panel('Incident scope', scope, status('Queued')) +
    panel('Failed production check', evidence) +
    back
  );
}
