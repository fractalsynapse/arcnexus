import type { ActivitySelection, TaskContext } from '../../architecture/src/index.js';
import { ClarificationRequired } from '../../workflow/src/index.js';
import { InvalidCodexResponse } from './codex.js';
import type { HostTask } from './index.js';
import { inboxIdentity, verificationContext } from './research.js';

type Assignment = Omit<TaskContext, 'goal' | 'worktree'>;

interface Clarification {
  scope: string;
  question: string;
  answer?: string;
}

/** Resume the requesting actor with human answers from the task journal. */
export class Clarifications {
  /** Bind questions to one actor, activity and retained task position. */
  constructor(
    private readonly task: HostTask,
    private readonly selection: ActivitySelection,
    private readonly signal: AbortSignal,
  ) {}

  /** Resolve any retained gate before invoking the actor again. */
  async run(data: Assignment, invoke: (data: Assignment) => Promise<unknown>) {
    const scope = inboxIdentity(this.task, this.selection, data);
    const answers = this.retained(scope);
    const assignment = data.assignment;
    while (true) {
      for (const [question, answer] of answers)
        if (answer === undefined) answers.set(question, await this.ask(scope, question));
      const clarifications = Array.from(answers, ([question, answer]) => ({ question, answer }));
      const current = clarifications.length
        ? { ...data, assignment: { ...assignmentFields(assignment), clarifications } }
        : data;
      const reply = await invoke(current);
      this.signal.throwIfAborted();
      const question = requestedQuestion(reply);
      if (question === undefined) return reply;
      if (answers.has(question))
        throw new InvalidCodexResponse(`Clarification already answered: ${question}`);
      const clarification = { scope, question };
      this.task.note({ clarification, ...verificationContext(this.task, this.selection, data) });
      answers.set(question, undefined);
    }
  }

  /** Rebuild the open and answered questions for this exact scope. */
  private retained(scope: string) {
    const answers = new Map<string, string | undefined>();
    for (const { clarification } of this.task.observations<{ clarification?: Clarification }>())
      if (clarification?.scope === scope) answers.set(clarification.question, clarification.answer);
    return answers;
  }

  /** Persist a verbatim answer before the activation can continue. */
  private async ask(scope: string, question: string) {
    this.signal.throwIfAborted();
    const answer = await this.task.ask?.(question, this.signal);
    this.signal.throwIfAborted();
    if (!answer?.trim()) throw new ClarificationRequired(question);
    this.task.note({ clarification: { scope, question, answer } });
    return answer;
  }
}

/** Preserve an unstructured original assignment as a single value. */
function assignmentFields(assignment: unknown) {
  return assignment && typeof assignment === 'object' && !Array.isArray(assignment)
    ? assignment
    : { original: assignment };
}

/** Require a meaningful question before opening a human gate. */
function requestedQuestion(reply: unknown) {
  if (!reply || typeof reply !== 'object' || !('kind' in reply) || reply.kind !== 'question')
    return;
  if (!('question' in reply) || typeof reply.question !== 'string' || !reply.question.trim())
    throw new InvalidCodexResponse('question: expected a nonempty human question');
  return reply.question;
}
