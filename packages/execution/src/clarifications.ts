import type { ActivitySelection, TaskContext } from '../../architecture/src/index.js';
import { ClarificationRequired, type TaskQuestion } from '../../workflow/src/index.js';
import { objectiveReviewLabel } from '../../planner/src/objective-review.js';
import { InvalidCodexResponse } from './codex.js';
import type { HostTask } from './index.js';
import { inboxIdentity, verificationContext } from './research.js';

type Assignment = Omit<TaskContext, 'goal' | 'worktree'>;

interface ReviewOptions {
  accepts?: (answer: string) => boolean;
  review?: TaskQuestion['review'];
}

export interface Clarification extends TaskQuestion {
  answer?: string;
  evidence?: string;
}

/** Resume the requesting actor with human answers from the task journal. */
export class Clarifications {
  /** Bind the caller to its explicit continuity revision, or the exact admission for host gates. */
  constructor(
    private readonly task: HostTask,
    private readonly selection: ActivitySelection,
    private readonly signal: AbortSignal,
    private readonly revision?: string,
  ) {}

  /** Resolve any retained gate before invoking the actor again. */
  async run(
    data: Assignment,
    invoke: (data: Assignment) => Promise<unknown>,
    options: ReviewOptions = {},
  ) {
    const scope = inboxIdentity(this.task, this.selection, data, this.revision);
    const answers = this.retained(scope);
    while (true) {
      for (const [question, gate] of answers)
        if (gate.answer === undefined) answers.set(question, await this.ask(gate, options.accepts));
      const reply = await invoke(withClarifications(data, [...answers.values()]));
      this.signal.throwIfAborted();
      const question = requestedQuestion(reply);
      if (question === undefined) return reply;
      if (answers.has(question))
        throw new InvalidCodexResponse(`Clarification already answered: ${question}`);
      const clarification = this.openQuestion({ scope, question, review: options.review });
      this.task.note({ clarification, ...verificationContext(this.task, this.selection, data) });
      answers.set(question, clarification);
    }
  }

  /** Read answered questions for the original activation without including other gates. */
  answers(data: Assignment) {
    return [
      ...this.retained(inboxIdentity(this.task, this.selection, data, this.revision)).values(),
    ].flatMap(({ question, answer }) => (answer === undefined ? [] : [{ question, answer }]));
  }

  /** Use the ordinary durable conversation for a host-owned approval question. */
  async decide(data: Assignment, question: string, options: ReviewOptions = {}) {
    await this.run(
      data,
      () => Promise.resolve(this.answers(data).length ? undefined : { kind: 'question', question }),
      options,
    );
    return this.answers(data)[0]!.answer;
  }

  /** Rebuild the open and answered questions for this exact scope. */
  private retained(scope: string) {
    const answers = new Map<string, Clarification>();
    for (const { clarification } of this.task.observations<{ clarification?: Clarification }>())
      if (clarification?.scope === scope) answers.set(clarification.question, clarification);
    return answers;
  }

  /** Keep the exact open question available even before there is an answer. */
  private openQuestion(gate: TaskQuestion) {
    const evidence = this.task.store(
      'clarification-question.json',
      JSON.stringify({ ...this.selection, ...gate }, null, 2),
    );
    return { ...gate, evidence };
  }

  /** Persist a verbatim answer before the activation can continue. */
  private async ask(gate: Clarification, accepts?: (answer: string) => boolean) {
    const { question } = gate;
    this.signal.throwIfAborted();
    const answer = await this.requestAnswer(gate, accepts);
    this.signal.throwIfAborted();
    if (!answer?.trim()) {
      const retained = gate.evidence ? gate : this.openQuestion(gate);
      if (retained !== gate) this.task.note({ clarification: retained });
      throw new ClarificationRequired(gate.review ? objectiveReviewLabel + '.' : question, [
        retained.evidence!,
      ]);
    }
    const evidence = this.task.store(
      'clarification.json',
      JSON.stringify({ ...this.selection, question, answer }, null, 2),
    );
    const clarification = { ...gate, answer, evidence };
    this.task.note({ clarification });
    return clarification;
  }

  /** Ask again on invalid input without recording it as a decision. */
  private async requestAnswer(gate: Clarification, accepts?: (answer: string) => boolean) {
    const { question, scope, review } = gate;
    let prompt = question;
    while (true) {
      const answer = await this.task.ask?.(prompt, this.signal, { question, scope, review });
      this.signal.throwIfAborted();
      if (!answer?.trim() || !accepts || accepts(answer)) return answer;
      prompt = `Invalid review response. Follow the review instructions.\n\n${question}`;
    }
  }
}

/** Give the resumed actor both the answer and the reviewable host reference. */
function withClarifications(data: Assignment, gates: readonly Clarification[]): Assignment {
  if (!gates.length) return data;
  const clarifications = gates.map(({ question, answer }) => ({ question, answer }));
  const refs = gates.flatMap(({ evidence }) => (evidence ? [evidence] : []));
  return {
    ...data,
    assignment: { ...assignmentFields(data.assignment), clarifications },
    evidence: [...new Set([...(data.evidence ?? []), ...refs])],
  };
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
