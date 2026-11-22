import { showInspector } from './inspector.ts';
import { data, inspector } from './model.ts';
import { countDetails } from './timeline.ts';
import {
  cacheRate,
  escape,
  factList,
  icon,
  readouts,
  status,
  tokenCount,
  tokenPair,
} from './view.ts';

export function roundFooter() {
  const { ended, wall } = data.round;
  return `<button type="button" class="arc-link arc-metrics-trigger" data-action="round-metrics"
    aria-label="Round metrics" data-tooltip="Round metrics" aria-haspopup="dialog">${icon('chart-no-axes-column')}</button>
  <div class="arc-footer-readout">
    ${status('Completed')}<strong>Refine</strong>
    <span>Updated <time>${escape(ended)} ET</time></span>
    <span>Elapsed <strong>${escape(wall)}</strong></span>
    <span>Tokens (in / out) <strong>${roundTokens()}</strong></span>
  </div>`;
}

function roundTokens() {
  const usage = data.round.usage;
  return tokenPair(usage.input_tokens, usage.output_tokens);
}

export function openRoundMetrics(opener: HTMLButtonElement) {
  showInspector(opener, 'End-to-end refinement metrics', () => {
    inspector.tool = null;
    return roundEvidence();
  });
}

function roundEvidence() {
  const { wall, native, coverage, usage } = data.round;
  const tools = data.toolUsage;
  const providerOnly = tools.provider - tools.host;
  const names = { ...tools.names };
  for (const [name, , , , , , , flags] of Object.values(data.tools)) {
    if (flags & 4) names[name] = (names[name] ?? 0) + 1;
  }
  const report = Object.entries(names).sort((a, b) => b[1] - a[1]);
  return (
    '<p class="arc-muted">Plan · Architect · Run</p>' +
    readouts([
      ['State', status('Completed')],
      ['Wall time', escape(wall)],
      ['Codex execution time', escape(native)],
      ['Model messages', tokenCount(tools.messages)],
      ['Tool calls', tokenCount(tools.provider)],
      ['Reported tokens (in / out)', roundTokens()],
      ['Token cache rate', cacheRate(usage.input_tokens, usage.cached_input_tokens)],
      ['Activations with token usage', coverage.withReportedUsage + ' / ' + coverage.activations],
    ]) +
    '<div class="arc-metric-details">' +
    countDetails({ report, providerOnly }) +
    evidenceNotes() +
    '</div>'
  );
}

function evidenceNotes() {
  const notes = [
    'Round 1 completed after two controlled interruptions. It was excluded from qualification because it received operator-assisted regression evidence.',
    'Eight goals assessed, with six staging merges and two satisfied by evidence.',
    'Codex execution time totals recorded invocations across the round. Cached input is included in reported input. Two interrupted activations have no reported usage.',
    'Cost unavailable. The evidence has no verified pricing or billing basis.',
    'Stable milestone and activation IDs would make operation attribution explicit.',
    'Review next steps come from the subsequent plan. A verdict-to-action link would make that association explicit.',
    'File dates and revisions come from Git. The Plan file manager includes preview topic labels.',
    data.round.following,
  ];
  return `<details><summary>Evidence coverage and gaps</summary>${factList(notes)}</details>`;
}
