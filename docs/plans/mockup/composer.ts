import { render, workspace } from './main.ts';
import { data, state, composerState, dom } from './model.ts';
import type { EventRow, Actor, PreviewCommand } from './model.ts';
import { escape, options } from './view.ts';
import { startPlanQuestion } from './questions.ts';

export function target(): Actor | null {
  const area = workspace();
  if (area === 'plan' || area === 'architect')
    return { key: area, role: area === 'plan' ? 'Planner' : 'Architect' };
  const route = state.route;
  const goal = state.goal;
  if (route.startsWith('/run/direction/')) return { key: goal + ':director', role: 'Director' };
  if (route.startsWith('/run/review/')) return { key: goal + ':assessment', role: 'Reviewer' };
  if (route.startsWith('/run/component/') || route.startsWith('/run/activity/')) {
    return state.component
      ? { key: goal + ':steward:' + state.component, role: state.component + ' steward' }
      : null;
  }
  return null;
}

export function previewRows() {
  const actor = target();
  return actor ? (composerState.conversations.get(actor.key) ?? []) : [];
}

export function plannerRows(rows: EventRow[]): EventRow[] {
  const gate = data.plan.clarification;
  if (!gate) return rows;
  const withGate: EventRow[] = [
    ...rows,
    [
      shortTime(gate.time),
      'question',
      'Planner · Asked for approval',
      gate.question,
      gate.sequence,
    ],
    [
      shortTime(gate.answerTime),
      'answer',
      'Operator · Recorded reply',
      gate.answer,
      gate.answerSequence,
    ],
  ];
  return withGate.sort((a, b) => Number(a[4]) - Number(b[4]));
}

export function shortTime(time: string) {
  return time
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(time))
    : '—';
}

export function addPreviewMessage(recipient: Actor, label: string, text: string) {
  const existing = composerState.conversations.get(recipient.key) ?? [];
  existing.push([
    '—',
    'preview',
    label + ' · ' + recipient.role + ' (preview)',
    text,
    'preview-' + ++composerState.sequence,
  ]);
  composerState.conversations.set(recipient.key, existing);
}

export function commandName(operation: string) {
  return operation === 'plan'
    ? 'Plan'
    : operation === 'architect'
      ? 'Architect'
      : operation === 'run'
        ? 'Run'
        : 'Refine';
}

export function commandItem(item: PreviewCommand, label: string) {
  return (
    '<li><b>' +
    escape(commandName(item.operation)) +
    '</b> · ' +
    label +
    (item.instruction ? '<small>' + escape(item.instruction) + '</small>' : '') +
    '</li>'
  );
}

export function queueTray() {
  const { active, queue, waiting } = composerState;
  if (!active && !queue.length) return '';
  const advance = active?.operation === 'plan' && !active.prompted && data.plan.clarification
    ? 'Advance to approval question' : 'Advance preview';
  return (
    '<details class="arc-queue"><summary>Preview queue · ' +
    queue.length +
    ' waiting</summary><ol>' +
    (active ? commandItem(active, waiting ? 'Awaiting reply' : 'Active') : '') +
    queue.map((item) => commandItem(item, 'Queued')).join('') +
    '</ol>' +
    (active
      ? '<button type="button" class="arc-button" data-action="advance-queue"' +
        (waiting ? ' disabled' : '') +
        '>' + advance + '</button>'
      : '') +
    '</details>'
  );
}

function steeringTarget() {
  const actor = target();
  const active = composerState.active?.actor;
  return active && !composerState.waiting && active.key === actor?.key ? active : null;
}

export function composerUI(reset = false) {
  const actor = steeringTarget();
  const mode = dom<HTMLSelectElement>('.arc-launch select');
  const choices: [string, string][] = [['plan', 'Plan'], ['architect', 'Architect'], ['run', 'Run']];
  if (actor) choices.unshift(['steer', 'Steer']);
  const valid = choices.some(([value]) => value === mode.value);
  const selected = reset || !valid ? choices[0]?.[0] : mode.value;
  mode.innerHTML = options(choices, selected);
  const input = dom<HTMLTextAreaElement>('.arc-launch textarea');
  const steer = mode.value === 'steer' && actor;
  input.placeholder = steer ? `Steer ${actor.role}…` : 'Add an instruction…';
  dom('.arc-instruction-label').innerHTML = steer
    ? 'Steering message'
    : 'Instruction <small>optional</small>';
  dom('.arc-compose-state').innerHTML =
    (composerState.waiting
      ? `<div class="arc-wait"><strong>Planner is waiting for a reply</strong>
        <button type="button" class="arc-button" data-question="${escape(composerState.waiting)}">Open question</button></div>`
      : '') +
    queueTray() +
    (composerState.feedback
      ? `<small role="status">${escape(composerState.feedback)}</small>`
      : '');
}

export function sendSteering(instruction: string) {
  const recipient = steeringTarget();
  if (!recipient || !instruction) {
    composerState.feedback = 'Enter a steering message while the displayed agent is running.';
    composerUI();
    return;
  }
  addPreviewMessage(recipient, 'You · Steer', instruction);
  composerState.feedback = 'Preview steering sent to ' + recipient.role;
  dom<HTMLTextAreaElement>('.arc-launch textarea').value = '';
  render();
}

export function enqueue(operation: string, instruction: string) {
  const next = { operation, instruction };
  if (composerState.active) {
    composerState.queue.push(next);
    composerState.feedback = commandName(operation) + ' queued in preview';
  } else {
    startCommand(next);
    composerState.feedback = commandName(operation) + ' started in preview';
  }
  dom<HTMLTextAreaElement>('.arc-launch textarea').value = '';
  composerUI(true);
}

export function advanceQueue() {
  if (composerState.waiting) return;
  const active = composerState.active;
  if (active?.operation === 'plan' && !active.prompted && data.plan.clarification) {
    active.prompted = true;
    startPlanQuestion();
    composerUI(true);
    render();
    return;
  }
  startCommand(composerState.queue.shift());
  composerState.feedback = composerState.active
    ? commandName(composerState.active.operation) + ' started in preview'
    : 'Preview queue is empty';
  composerUI(true);
}

function startCommand(command?: PreviewCommand) {
  if (!command) {
    composerState.active = null;
    return;
  }
  const { operation } = command;
  const actor = operation === 'run'
    ? { key: state.goal + ':director', role: 'Director' }
    : operation === 'architect'
      ? { key: 'architect', role: 'Architect' }
      : { key: 'plan', role: 'Planner' };
  composerState.active = { ...command, actor, prompted: false };
}

export function submitComposer(values: FormData) {
  const mode = String(values.get('operation'));
  const instruction = String(values.get('instruction') ?? '').trim();
  if (mode === 'steer') sendSteering(instruction);
  else if (mode === 'plan' || mode === 'architect' || mode === 'run') enqueue(mode, instruction);
}
