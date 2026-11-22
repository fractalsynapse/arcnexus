import { render, workspace } from './main.ts';
import { data, state, composerState, requireValue, dom } from './model.ts';
import type { EventRow, Actor, PreviewCommand } from './model.ts';
import { escape } from './view.ts';

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
  const { active, queue, question } = composerState;
  if (!active && !queue.length) return '';
  return (
    '<details class="arc-queue"><summary>Preview queue · ' +
    queue.length +
    ' waiting</summary><ol>' +
    (active ? commandItem(active, question ? 'Awaiting reply' : 'Active') : '') +
    queue.map((item) => commandItem(item, 'Queued')).join('') +
    '</ol>' +
    (active
      ? '<button type="button" class="arc-button" data-action="advance-queue"' +
        (question ? ' disabled' : '') +
        '>Advance preview</button>'
      : '') +
    '</details>'
  );
}

export function composerUI() {
  const actor = target();
  const question = composerState.question;
  const mode = dom<HTMLSelectElement>('.arc-launch select');
  requireValue(mode.querySelector<HTMLOptionElement>('option[value="steer"]')).disabled = !actor;
  requireValue(mode.querySelector<HTMLOptionElement>('option[value="answer"]')).hidden = !question;
  if ((mode.value === 'answer' && !question) || (mode.value === 'steer' && !actor))
    mode.value = 'plan';
  const reply = mode.value === 'answer' ? question : null;
  const input = dom<HTMLTextAreaElement>('.arc-launch textarea');
  if (reply) input.placeholder = `Reply to ${reply.recipient.role}…`;
  else
    input.placeholder =
      mode.value === 'steer' && actor ? `Steer ${actor.role}…` : 'Add an instruction…';
  dom('.arc-compose-state').innerHTML =
    waitingPrompt() +
    queueTray() +
    (composerState.feedback
      ? `<small role="status">${escape(composerState.feedback)}</small>`
      : '');
}

function waitingPrompt() {
  const question = composerState.question;
  if (!question) return '';
  return `<div class="arc-wait">
    <strong>${escape(question.recipient.role)} is waiting for a reply</strong>
    <span>${escape(question.text.split('\n\n')[0])}</span>
  </div>`;
}

export function selectReply() {
  const gate = requireValue(data.plan.clarification);
  composerState.question = { recipient: { key: 'plan', role: 'Planner' }, text: gate.question };
  composerState.feedback = 'Preview of the recorded approval question';
  composerUI();
  dom<HTMLSelectElement>('.arc-launch select').value = 'answer';
  composerUI();
  dom<HTMLTextAreaElement>('.arc-launch textarea').focus();
}

export function sendMessage(mode: string, instruction: string) {
  const recipient = mode === 'answer' ? composerState.question?.recipient : target();
  if (!recipient || !instruction) {
    composerState.feedback =
      mode === 'answer' ? 'Enter a reply.' : 'Enter a steering message for the displayed agent.';
    composerUI();
    return;
  }
  addPreviewMessage(recipient, mode === 'answer' ? 'You · Reply' : 'You · Steer', instruction);
  if (mode === 'answer') {
    composerState.question = null;
    composerState.active ??= composerState.queue.shift() ?? null;
    composerState.feedback = 'Preview reply recorded for ' + recipient.role;
    dom<HTMLSelectElement>('.arc-launch select').value = 'steer';
  } else composerState.feedback = 'Preview steering sent to ' + recipient.role;
  dom<HTMLTextAreaElement>('.arc-launch textarea').value = '';
  render();
}

export function enqueue(operation: string, instruction: string) {
  const next = { operation, instruction };
  if (composerState.active || composerState.question) {
    composerState.queue.push(next);
    composerState.feedback = commandName(operation) + ' queued in preview';
  } else {
    composerState.active = next;
    composerState.feedback = commandName(operation) + ' started in preview';
  }
  dom<HTMLTextAreaElement>('.arc-launch textarea').value = '';
  composerUI();
}

export function advanceQueue() {
  if (composerState.question) return;
  composerState.active = composerState.queue.shift() ?? null;
  composerState.feedback = composerState.active
    ? commandName(composerState.active.operation) + ' started in preview'
    : 'Preview queue is empty';
  composerUI();
}

export function submitComposer(values: FormData) {
  const mode = String(values.get('operation'));
  const instruction = String(values.get('instruction') ?? '').trim();
  if (mode === 'steer' || mode === 'answer') sendMessage(mode, instruction);
  else enqueue(mode, instruction);
}
