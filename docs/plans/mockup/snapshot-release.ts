import { exampleLabel } from './ogsm.ts';
import { escape, localDate, noData, panel, pill, readouts, status, title } from './view.ts';

const previousRelease = { tag: 'v0.3.0-example', source: 'staging-base' };
const revisions = [
  {
    id: 'staging-a',
    pr: 'A',
    title: 'Record the Planner file inventory',
    mergedAt: '2026-11-20T15:00:00Z',
    evidence: 'The inventory records the paths the Planner discovered.',
  },
  {
    id: 'staging-b',
    pr: 'B',
    title: 'Reuse the inventory during planning',
    mergedAt: '2026-11-21T15:00:00Z',
    evidence: 'Planner regression checks confirmed inventory reuse and preserved file references.',
  },
  {
    id: 'staging-c',
    pr: 'C',
    title: 'Report discovery calls in the timeline',
    mergedAt: '2026-11-22T15:00:00Z',
    evidence: 'Staging checks confirmed that the timeline captures discovery tool calls.',
  },
] as const;

type StagingRevision = (typeof revisions)[number];
type PreparedCandidate = {
  previous: typeof previousRelease;
  revision: StagingRevision;
  included: StagingRevision[];
};

let cVerified = false;
let selected = revisions.findLast(verified) ?? revisions[0];
let prepared: PreparedCandidate | undefined;

function verified(revision: StagingRevision) {
  return revision.pr !== 'C' || cVerified;
}

export function selectStagingRevision(id: string) {
  const revision = revisions.find((item) => item.id === id);
  if (!revision || !verified(revision)) return false;
  selected = revision;
  return true;
}

export function changeSnapshotPreview(action: string) {
  if (action === 'verify-example-staging' && !cVerified) cVerified = true;
  else if (
    action === 'prepare-release-candidate' &&
    verified(selected) &&
    prepared?.revision !== selected
  )
    prepared = {
      previous: previousRelease,
      revision: selected,
      included: includedThrough(selected),
    };
  else return false;
  return true;
}

function includedThrough(revision: StagingRevision) {
  return revisions.slice(0, revisions.indexOf(revision) + 1);
}

export function snapshotReleasePage() {
  const pinnedPreview = prepared?.revision === selected ? prepared : undefined;
  const included = pinnedPreview?.included ?? includedThrough(selected);
  return (
    title('Release', 'Promote a verified staging snapshot', exampleLabel()) +
    `<div class="arc-grid equal">
      <div class="arc-stack">${stagingSelector()}${candidatePanel()}</div>
      ${includedPanel(included, pinnedPreview ? 'Pinned' : 'Preview')}
    </div>`
  );
}

function stagingSelector() {
  const choices = [...revisions].reverse().map((revision) => {
    const state = verified(revision) ? 'Verified on staging' : 'Awaiting checks';
    const label = `${revision.pr} · ${revision.id} · ${state} · ${localDate(revision.mergedAt)}`;
    return `<option value="${revision.id}" ${revision === selected ? 'selected' : ''} ${verified(revision) ? '' : 'disabled'}>${escape(label)}</option>`;
  });
  return panel(
    'Staging snapshot',
    readouts([
      ['Previous production tag', `<code>${escape(previousRelease.tag)}</code>`],
      ['Source staging revision', `<code>${escape(previousRelease.source)}</code>`],
    ]) +
      `<label><span id="staging-revision-label">Staging revision</span><select data-change="staging-revision" aria-labelledby="staging-revision-label">${choices.join('')}</select></label>
    <div class="arc-row">${status('Verified on staging')}<small>Merged ${escape(localDate(selected.mergedAt))}</small></div>
    ${stagingControls()}`,
  );
}

function stagingControls() {
  const prepare =
    prepared?.revision === selected
      ? ''
      : `<button type="button" class="arc-button solid" data-action="prepare-release-candidate">${prepared ? 'Replace prepared candidate' : 'Prepare candidate'}</button>`;
  const simulate = cVerified
    ? ''
    : '<button type="button" class="arc-button" data-action="verify-example-staging">Simulate C verification</button>';
  return `<div class="arc-row">${prepare}${simulate}</div>`;
}

function candidatePanel() {
  if (!prepared)
    return panel(
      'Prepared candidate',
      noData('Prepare the selected revision to pin its release scope.'),
    );
  const laterVerified = revisions.findLast(verified);
  const newerAvailable =
    laterVerified && revisions.indexOf(laterVerified) > revisions.indexOf(prepared.revision);
  return panel(
    'Prepared candidate',
    readouts([
      ['Production baseline', `<code>${escape(prepared.previous.tag)}</code>`],
      ['Pinned staging revision', `<code>${escape(prepared.revision.id)}</code>`],
      ['Included PRs', escape(prepared.included.map((change) => change.pr).join(', '))],
    ]) +
      (newerAvailable
        ? '<p role="status"><strong>Newer staging revision available</strong></p>'
        : ''),
    pill('Pinned', 'quiet'),
  );
}

function includedPanel(included: StagingRevision[], mode: 'Preview' | 'Pinned') {
  const rows = included.map(
    (change) => `<li><details>
    <summary><span class="arc-release-label">PR ${change.pr}</span><span class="arc-snapshot-pr-title">${escape(change.title)}</span></summary>
    <div class="arc-release-stage-body">${readouts(
      [
        ['Issue', `Issue ${change.pr}`],
        ['Staging merge commit', `<code>${escape(change.id)}</code>`],
      ],
      'arc-release-revisions',
    )}<p>${escape(change.evidence)}</p></div></details></li>`,
  );
  return panel(
    'Included PRs',
    `<ol class="arc-release-stages">${rows.join('')}</ol>`,
    `<div class="arc-row">${pill(`${mode} · ${selected.id}`, 'quiet')}<small>${included.length} ${included.length === 1 ? 'PR' : 'PRs'}</small></div>`,
  );
}
