import { AgentActivityHold } from '../../agent/src/index.js';
import type { ArchitectureDecision } from '../../architecture/src/index.js';
import { hostTask } from '../../execution/src/index.js';
import type { ActivityCheckpoint, TaskInput, TaskOutcome, TaskSession } from './services.js';

type Request = Extract<ArchitectureDecision, { kind: 'supplier' }>;

/** Fulfil an Architect's explicit owner question through the existing child task lifecycle. */
export async function architectInbox(
  session: TaskSession,
  request: Request,
  run: (input: TaskInput) => Promise<TaskOutcome>,
) {
  const task = hostTask(session);
  const goal = `Answer the Architect's question completely.\n\n${request.question}`;
  const scope = `architecture:inbox:${request.scope}:${request.owner}:${request.question}`;
  task.cleanup();
  const outcome = await run({
    directory: task.capture.source.root,
    goal,
    scope,
    inbox: { owner: request.owner, question: request.question! },
  });
  if (outcome.kind !== 'satisfied') return outcome;
  const answer = completeAnswer(task.journal.childEvents(goal, scope), request, outcome);
  task.note({
    projectReply: {
      scope: request.scope,
      owner: request.owner,
      question: request.question,
      answer: answer.answer,
      evidence: [...answer.evidence, ...outcome.evidence],
    },
  });
}

/** Require the accountable supplier's complete answer before allowing its requester to resume. */
function completeAnswer(events: readonly unknown[], request: Request, outcome: TaskOutcome) {
  const answer = events
    .map((event) => (event as { activation?: ActivityCheckpoint }).activation)
    .findLast(
      (event) =>
        event?.owner === request.owner &&
        event.outcome.kind === 'completed' &&
        event.outcome.answer,
    );
  if (!answer || answer.outcome.kind !== 'completed' || !answer.outcome.answer)
    throw new AgentActivityHold(
      `Supplier ${request.owner} did not return the complete answer`,
      outcome.evidence,
    );
  return { answer: answer.outcome.answer, evidence: answer.outcome.evidence };
}
