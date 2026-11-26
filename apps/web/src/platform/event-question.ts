import { createElement as h } from 'react';
import { readObjectiveDecision } from '../../../../packages/planner/src/objective-review.js';
import {
  CommandQuestion,
  type CommandBinding,
  type CommandState,
} from '../../../../packages/ui/src/index.js';
import type { Question } from './timeline-groups.js';

interface QuestionProps {
  question: Question;
  command: CommandState;
  binding: CommandBinding;
  execution?: string;
}

export function EventQuestion({ question, command, binding, execution }: QuestionProps) {
  const gate = relatedGate(question, command, execution);
  const waiting = question.answer === undefined && !!gate;
  return h(
    'div',
    { className: 'arc-plan-question', 'data-waiting': waiting || undefined },
    h('strong', null, question.review ? 'Objective review' : 'Question'),
    h('p', { className: 'arc-plan-message' }, question.review?.summary ?? question.question),
    question.answer !== undefined
      ? h(AnsweredQuestion, { answer: displayedAnswer(question, question.answer) })
      : gate &&
          binding.answer &&
          h(CommandQuestion, {
            key: gate.key,
            identity: gate.key,
            label: 'Question',
            question: gate.question,
            review: gate.review,
            send: (answer) => binding.answer!(gate.key, answer),
          }),
  );
}

function relatedGate(question: Question, command: CommandState, execution?: string) {
  const { gate } = command;
  if (!gate || command.execution !== execution) return;
  const matches = question.review
    ? question.review.id === gate.review?.id
    : question.question === gate.question;
  return matches ? gate : undefined;
}

function AnsweredQuestion({ answer }: { answer: string }) {
  return h('p', { className: 'arc-plan-message' }, h('strong', null, 'Answered '), answer);
}

function displayedAnswer({ review }: Question, answer: string) {
  if (!review) return answer;
  try {
    const choice = readObjectiveDecision(answer, review);
    if (choice.action === 'approve')
      return (review.readOnly ? 'Retained ' : 'Approved ') + choice.selected.join(', ');
    if (choice.action === 'revise') return choice.feedback ?? 'Submitted revised wording';
    return 'Declined';
  } catch {
    return answer;
  }
}
