import { fileName } from './file-topics.ts';
import { showInspector } from './inspector.ts';
import { data, files, inspector, state } from './model.ts';
import type { DesignFile, Revision } from './model.ts';
import { ogsmExample, ogsmGoal, ogsmGoalFile } from './ogsm-example.ts';
import {
  escape,
  githubReferences,
  localDate,
  noData,
  outcomeName,
  panel,
  pill,
  readouts,
  status,
} from './view.ts';

export function exampleLabel() {
  return pill('Illustrative example', 'quiet');
}

function measureRows(candidate: boolean) {
  const rows: [string, string][] = [
    ['Baseline', String(ogsmExample.baseline)],
    ['Target', '≤ ' + ogsmExample.target],
    ['Latest verified', String(ogsmExample.verified)],
  ];
  if (candidate) rows.push(['Candidate', String(ogsmExample.candidate)]);
  return readouts(rows);
}

function measurementDetails() {
  return `<details><summary>Measurement details</summary><p><strong>Host tool log.</strong> ${escape(ogsmExample.method)}</p></details>`;
}

export function openGoalProgress(opener: HTMLButtonElement) {
  const item = files[state.fileId];
  const revision = item?.revisions[state.revision];
  if (item?.type !== 'Goal' || !revision) return;
  showInspector(opener, 'Goal progress', () => {
    inspector.tool = null;
    return `<h3>${escape(revision.name)}</h3>` + goalProgressEvidence(item, revision);
  });
}

function goalProgressEvidence(item: DesignFile, revision: Revision) {
  const captured = item.revisions.find((entry) => !entry.id.startsWith('Draft '));
  if (revision !== captured) return noData('No progress evidence is linked to this file revision.');
  if (item === ogsmGoalFile) {
    return `<div>${exampleLabel()}</div><p><strong>Objective.</strong> ${escape(ogsmExample.objective)}</p>
      <h3>${escape(ogsmExample.measure)}</h3>${measureRows(false)}${measurementDetails()}
      ${runLink(ogsmGoal.id, '/run/direction/', 'View strategy in Run')}`;
  }
  const goal = data.goals.find(({ id }) => id === fileName(item.path));
  if (!goal) return noData('No assessment is recorded for this goal.');
  return (
    readouts([
      ['Latest assessment', status(outcomeName(goal.outcome.kind))],
      ['Recorded at', escape(localDate(goal.outcome.at))],
    ]) +
    (goal.outcome.summary ? `<p>${githubReferences(goal.outcome.summary)}</p>` : '') +
    noData('No quantitative goal observations recorded for this revision.') +
    runLink(goal.id, '/run/', 'Open goal in Run')
  );
}

function runLink(goal: string, route: string, label: string) {
  return `<div><button type="button" class="arc-button" data-goal="${escape(goal)}" data-go="${route}">${escape(label)}</button></div>`;
}

export function exampleStrategy(compact: boolean) {
  const strategy = `<h3>${escape(ogsmExample.strategy)}</h3><p>${escape(ogsmExample.rationale)}</p>`;
  return compact
    ? strategy
    : `${strategy}<h3>${escape(ogsmExample.measure)}</h3>${measureRows(true)}
    <p>Candidate improved. Target still open.</p>${measurementDetails()}`;
}

export function milestoneMeasures() {
  return panel(
    'Milestone measures',
    `<h3>${escape(ogsmExample.measure)}</h3>${measureRows(true)}
    ${readouts([[ogsmExample.quality, 'Pass']])}${measurementDetails()}`,
    exampleLabel(),
  );
}
