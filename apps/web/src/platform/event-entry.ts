import { readObjectiveDecision } from '../../../../packages/planner/src/objective-review.js';
import { createElement as h } from 'react';
import {
  CommandQuestion,
  Disclosure,
  LocalTime,
  type CommandBinding,
  type CommandState,
} from '../../../../packages/ui/src/index.js';
import { OperationRow } from './operation-row.js';
import { TimelineMessage } from './timeline-message.js';
import type { Operation, Question } from './timeline-groups.js';

interface EntryProps {
  entry: {
    timestamp: string | null;
    message?: string;
    question?: Question;
    operations: Operation[];
  };
  execution?: string;
  command: CommandState;
  binding: CommandBinding;
}

/** Keep the status message and its expandable tool calls together. */
export function EventEntry({ entry, execution, command, binding }: EntryProps) {
  const { timestamp, message, question, operations } = entry;
  return h(
    'article',
    { className: 'arc-plan-event' },
    h(LocalTime, { timestamp }),
    message && h(TimelineMessage, { message }),
    question && h(EventQuestion, { question, command, binding, execution }),
    !!operations.length && h(OperationGroup, { operations, execution }),
  );
}

function OperationGroup({
  operations,
  execution,
}: {
  operations: Operation[];
  execution?: string;
}) {
  const label = operations.length + (operations.length === 1 ? ' operation' : ' operations');
  return h(
    Disclosure,
    { label },
    h(
      'ul',
      null,
      operations.map((entry) => h(OperationRow, { key: entry.key, entry, execution })),
    ),
  );
}

type QuestionProps = Omit<EntryProps, 'entry'> & { question: Question };

function EventQuestion({ question, command, binding, execution }: QuestionProps) {
  const gate =
    command.execution === execution && command.gate?.question === question.question
      ? command.gate
      : undefined;
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(
      'p',
      { className: 'arc-plan-message' },
      question.review ? question.review.summary : question.question,
    ),
    question.answer !== undefined
      ? h(AnsweredQuestion, { answer: displayedAnswer(question, question.answer) })
      : gate &&
          binding.answer &&
          h(CommandQuestion, {
            identity: gate.key,
            label: 'Question',
            question: gate.question,
            review: gate.review,
            send: (answer) => binding.answer!(gate.key, answer),
          }),
  );
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
