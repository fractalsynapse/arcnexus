import { addPreviewMessage } from './composer.ts';
import { diffView, readPatch } from './diff.ts';
import { go } from './main.ts';
import { composerState, data, state } from './model.ts';
import type { PlanQuestion } from './model.ts';
import { breadcrumbs, escape, noData, panel, title } from './view.ts';

const planner = { key: 'plan', role: 'Planner' };

function recordedQuestion(): PlanQuestion | undefined {
  const gate = data.plan.clarification;
  if (!gate) return;
  const [prompt = '', ...supporting] = gate.question.split('\n\n');
  return {
    id: String(gate.sequence),
    prompt,
    supporting: supporting.join('\n\n'),
    recommendation: plannerRecommendation(),
    choices: /reply approve .* or skip/i.test(prompt)
      ? [
          ['approve', 'Approve these changes'],
          ['skip', 'Skip these changes'],
        ]
      : undefined,
    answer: gate.answer || undefined,
  };
}

function plannerRecommendation() {
  const response = data.plan.rows.find((row) => row[2] === 'Planner · Final model response');
  if (!response) return undefined;
  try {
    const { summary } = JSON.parse(response[3]) as { summary?: unknown };
    return typeof summary === 'string' ? summary : undefined;
  } catch {
    return undefined;
  }
}

export function findQuestion(id: string) {
  const historical = recordedQuestion();
  return composerState.questions.get(id) ?? (historical?.id === id ? historical : undefined);
}

export function startPlanQuestion() {
  const source = recordedQuestion();
  if (!source) return;
  const id = 'question-' + ++composerState.sequence;
  composerState.questions.set(id, { ...source, id, answer: undefined });
  composerState.waiting = id;
  const history = composerState.conversations.get(planner.key) ?? [];
  history.push(['—', 'question', 'Planner · Approval requested (preview)', source.prompt, id]);
  composerState.conversations.set(planner.key, history);
  composerState.feedback = '';
}

export function openQuestion(id: string) {
  if (!findQuestion(id)) return;
  state.questionId = id;
  go('/plan/question/');
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
  composerState.feedback = 'Preview reply recorded for Planner';
  addPreviewMessage(planner, 'You · Reply', answer);
  go('/plan/');
}

function answerForm(question: PlanQuestion) {
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
  const heading = breadcrumbs([['Plan', '/plan/'], ['Question']]) + title('Planner question');
  if (!question) return heading + panel('Question', noData('No question selected.'));
  const patches = readPatch(question.supporting);
  const context = question.recommendation
    ? `<h3>Planner recommendation</h3><p>${escape(question.recommendation)}</p>`
    : '';
  const supporting =
    !patches.length && question.supporting ? `<p>${escape(question.supporting)}</p>` : '';
  const answer = question.answer
    ? panel('Recorded reply', `<p>${escape(question.answer)}</p>`)
    : question.id === composerState.waiting
      ? panel('Reply', answerForm(question))
      : '';
  return (
    heading +
    panel('Question', `<p>${escape(question.prompt)}</p>${context}${supporting}`) +
    (patches.length ? diffView('Proposed goal changes', patches) : '') +
    answer
  );
}
