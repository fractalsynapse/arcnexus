import { ogsmExample, ogsmGoal } from './ogsm-example.ts';
import { escape, panel, pill, readouts } from './view.ts';

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

export function goalProgress(exampleFileIndex?: number) {
  const button =
    exampleFileIndex === undefined
      ? `<button type="button" class="arc-button" data-goal="${ogsmGoal.id}" data-go="/run/direction/">View strategy in Run</button>`
      : `<button type="button" class="arc-button" data-file="${exampleFileIndex}">Open example goal</button>`;
  const intro =
    exampleFileIndex === undefined
      ? `<p><strong>Objective.</strong> ${escape(ogsmExample.objective)}</p>`
      : `<p>${escape(ogsmGoal.title)}</p>`;
  return panel(
    'Goal progress',
    `${intro}<h3>${escape(ogsmExample.measure)}</h3>
    ${measureRows(false)}${exampleFileIndex === undefined ? measurementDetails() : ''}<div>${button}</div>`,
    exampleLabel(),
  );
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
