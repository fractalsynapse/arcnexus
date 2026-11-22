import { addPreviewMessage, phaseActor } from './composer.ts';
import { diffView, readPatch } from './diff.ts';
import { go } from './main.ts';
import { composerState, data, state } from './model.ts';
import type { Area, WorkspaceQuestion } from './model.ts';
import { standalonePane } from './panels.ts';
import { breadcrumbs, escape, noData, panel, title } from './view.ts';

function recordedQuestion(area: Area, id?: string): WorkspaceQuestion | undefined {
  const gate = data[area].clarification;
  if (!gate || (id !== undefined && id !== String(gate.sequence))) return;
  const [prompt = '', ...supporting] = gate.question.split('\n\n');
  return {
    area,
    id: String(gate.sequence),
    prompt,
    supporting: supporting.join('\n\n'),
    recommendation: phaseRecommendation(area),
    choices: /reply approve .* or skip/i.test(prompt)
      ? [
          ['approve', 'Approve these changes'],
          ['skip', 'Skip these changes'],
        ]
      : undefined,
    answer: gate.answer || undefined,
  };
}

function phaseRecommendation(area: Area) {
  const name = area === 'plan' ? 'Planner' : 'Architecture';
  const response = data[area].rows.findLast((row) => row[1] === 'response' && row[2].startsWith(name + ' · '));
  if (!response) return undefined;
  try {
    const { summary } = JSON.parse(response[3]) as { summary?: unknown };
    return typeof summary === 'string' ? summary : undefined;
  } catch {
    return undefined;
  }
}

export function findQuestion(id: string) {
  if (!id) return;
  return composerState.questions.get(id) ?? recordedQuestion('plan', id) ?? recordedQuestion('architect', id);
}

export function startWorkspaceQuestion(area: Area) {
  const source = recordedQuestion(area);
  if (!source) return;
  const actor = phaseActor(area);
  const id = 'question-' + ++composerState.sequence;
  composerState.questions.set(id, { ...source, id, answer: undefined });
  composerState.waiting = id;
  const history = composerState.conversations.get(actor.key) ?? [];
  history.push(['—', 'question', actor.role + ' · Approval requested (preview)', source.prompt, id]);
  composerState.conversations.set(actor.key, history);
  composerState.feedback = '';
}

export function openQuestion(id: string) {
  const question = findQuestion(id);
  if (!question) return;
  state.questionId = id;
  go('/' + question.area + '/question/');
}

export function rememberAnswer(field: HTMLInputElement | HTMLTextAreaElement) {
  if (field.name !== 'question-reply' || field.form?.dataset.form !== 'question') return;
  const id = field.form.dataset.question;
  if (id && id === composerState.waiting) composerState.drafts.set(id, field.value);
}

export function submitAnswer(id: string, answer: string) {
  const question = composerState.questions.get(id);
  if (!question || id !== composerState.waiting || question.answer || !answer) return;
  if (question.choices && !question.choices.some(([value]) => value === answer)) return;
  question.answer = answer;
  composerState.drafts.delete(id);
  composerState.waiting = '';
  const actor = phaseActor(question.area);
  composerState.feedback = 'Preview reply recorded for ' + actor.role;
  addPreviewMessage(actor, 'You · Reply', answer);
  go('/' + question.area + '/');
}

function answerForm(question: WorkspaceQuestion) {
  const value = composerState.drafts.get(question.id) ?? '';
  const controls = question.choices
    ? `<fieldset><legend>Decision</legend>
      ${question.choices
        .map(
          ([key, label]) => `<label class="arc-checkbox">
        <input type="radio" name="question-reply" value="${escape(key)}" required
          ${value === key ? 'checked' : ''}>${escape(label)}</label>`,
        )
        .join('')}</fieldset>`
    : `<label>Reply<textarea name="question-reply" required>${escape(value)}</textarea></label>`;
  return `<form data-form="question" data-question="${escape(question.id)}" class="arc-question-form">
    ${controls}<button type="button" class="arc-button solid" data-action="apply-form">Send reply</button></form>`;
}

export function questionView() {
  const question = findQuestion(state.questionId);
  if (!question) return title('Question') + panel('Question', noData('No question selected.'));
  const actor = phaseActor(question.area);
  const page = question.area === 'plan' ? 'Plan' : 'Architect';
  const heading = breadcrumbs([[page, '/' + question.area + '/'], ['Question']]) + title(actor.role + ' question');
  const patches = readPatch(question.supporting);
  const context = question.recommendation
    ? `<h3>${actor.role} recommendation</h3><p>${escape(question.recommendation)}</p>`
    : '';
  const supporting =
    !patches.length && question.supporting ? `<p>${escape(question.supporting)}</p>` : '';
  const answer = question.answer
    ? panel('Recorded reply', `<p>${escape(question.answer)}</p>`)
    : question.id === composerState.waiting
      ? panel('Reply', answerForm(question))
      : '';
  const prompt = heading + panel('Question', `<p>${escape(question.prompt)}</p>${context}${supporting}`);
  if (!patches.length) return prompt + answer;
  const label = question.area === 'plan' ? 'Proposed goal changes' : 'Proposed architecture changes';
  return prompt + standalonePane({
    id: 'arc-proposed-changes',
    label: 'Changes',
    content: (action) => diffView(label, patches, { action }),
  }, { after: answer });
}
