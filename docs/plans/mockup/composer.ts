import { render, workspace } from './main.ts';
import { data, state, composerState, dom } from './model.ts';
import type { Area, EventRow, Actor, PreviewCommand } from './model.ts';
import { escape, options } from './view.ts';
import { findQuestion, startWorkspaceQuestion } from './questions.ts';
import { currentGoal, currentPlan, currentSnapshot } from './run-context.ts';

export function phaseActor(area: Area): Actor {
  return { key: area, role: area === 'plan' ? 'Planner' : 'Architect' };
}

function runActor(component: string): Actor {
  const key = state.goal + ':' + state.runRevision + ':' + component;
  return { key, role: component === 'direction' ? 'Director' :
    component === 'reviewer' ? 'Reviewer' : component + ' steward' };
}

export function target(): Actor | null {
  const area = workspace();
  if (area === 'plan' || area === 'architect') return phaseActor(area);
  const route = state.route;
  if (route.startsWith('/run/direction/')) return runActor('direction');
  if (route.startsWith('/run/review/')) return runActor('reviewer');
  if (route.startsWith('/run/component/') || route.startsWith('/run/activity/')) {
    return state.component ? runActor(state.component) : null;
  }
  return null;
}

export function previewRows() {
  const actor = target();
  return actor ? (composerState.conversations.get(actor.key) ?? []) : [];
}

export function phaseRows(area: Area): EventRow[] {
  const { rows, clarification: gate } = data[area];
  if (!gate) return rows;
  const withGate: EventRow[] = [
    ...rows,
    [
      shortTime(gate.time),
      'question',
      phaseActor(area).role + ' · Asked for approval',
      gate.question,
      gate.sequence,
    ],
  ];
  if (gate.answer) withGate.push([
      shortTime(gate.answerTime),
      'answer',
      'Operator · Recorded reply',
      gate.answer,
      gate.answerSequence,
    ]);
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
    escape(label) +
    (item.instruction ? '<small>' + escape(item.instruction) + '</small>' : '') +
    '</li>'
  );
}

export function queueTray() {
  const { active, queue, waiting } = composerState;
  if (!active && !queue.length) return '';
  const advance = pendingPhase(active) ? 'Advance to approval question' : 'Advance preview';
  const actor = activeActor();
  return (
    '<details class="arc-queue"><summary>Preview queue · ' +
    queue.length +
    ' waiting</summary><ol>' +
    (active ? commandItem(active, waiting ? 'Awaiting reply' : actor ? actor.role + ' active' : 'Active') : '') +
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
  const active = activeActor();
  return active && !composerState.waiting && active.key === actor?.key ? active : null;
}

function activeActor() {
  const active = composerState.active;
  return active?.actors[active.actorIndex];
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
  const waiting = findQuestion(composerState.waiting);
  input.placeholder = steer ? `Steer ${actor.role}…` : 'Add an instruction…';
  dom('.arc-instruction-label').innerHTML = steer
    ? 'Steering message'
    : 'Instruction <small>optional</small>';
  dom('.arc-compose-state').innerHTML =
    (waiting
      ? `<div class="arc-wait"><strong>${phaseActor(waiting.area).role} is waiting for a reply</strong>
        <button type="button" class="arc-button" data-question="${escape(waiting.id)}">Open question</button></div>`
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
  const actors = operation === 'run' ? runActors() :
    [phaseActor(operation === 'architect' ? 'architect' : 'plan')];
  const next = { operation, instruction, actors };
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

function runActors() {
  const snapshot = currentSnapshot();
  const observed = new Set(currentGoal().activations
    .filter((activation) => activation.sequence <= snapshot.seq)
    .map((activation) => activation.component));
  const owners = new Set((currentPlan()?.milestones ?? []).map((milestone) => milestone.owner));
  owners.delete('direction');
  owners.delete('reviewer');
  const order = ['direction', ...[...owners].filter((owner) => observed.has(owner))];
  if (observed.has('reviewer')) order.push('reviewer');
  return order.map(runActor);
}

function pendingPhase(active: typeof composerState.active): Area | undefined {
  if (!active || active.prompted) return;
  const area = active.operation;
  return (area === 'plan' || area === 'architect') && data[area].clarification
    ? area : undefined;
}

export function advanceQueue() {
  if (composerState.waiting) return;
  const active = composerState.active;
  const questionArea = pendingPhase(active);
  if (active && questionArea) {
    active.prompted = true;
    startWorkspaceQuestion(questionArea);
    render(true);
    return;
  }
  const nextActor = active?.actors[active.actorIndex + 1];
  if (active && nextActor) {
    active.actorIndex++;
    composerState.feedback = nextActor.role + ' started in preview';
    composerUI(true);
    return;
  }
  startCommand(composerState.queue.shift());
  composerState.feedback = composerState.active
    ? commandName(composerState.active.operation) + ' started in preview'
    : 'Preview queue is empty';
  composerUI(true);
}

function startCommand(command?: PreviewCommand) {
  composerState.active = command ? { ...command, actorIndex: 0, prompted: false } : null;
}

export function submitComposer(values: FormData) {
  const mode = String(values.get('operation'));
  const instruction = String(values.get('instruction') ?? '').trim();
  if (mode === 'steer') sendSteering(instruction);
  else if (mode === 'plan' || mode === 'architect' || mode === 'run') enqueue(mode, instruction);
}
