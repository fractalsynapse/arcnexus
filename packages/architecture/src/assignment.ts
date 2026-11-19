import type { HostTask } from '../../execution/src/index.js';

/** Supply accepted guide references and retained findings without repeating captured profiles. */
export function architectAssignment(
  task: HostTask,
  feedback: string | undefined,
  findings: string,
  responseRepair?: string,
) {
  const root = task.capture.project.knowledgeRoot ?? '.arc';
  return {
    milestone: 'Architecture assessment',
    acceptance: [],
    evidence: [findings],
    assignment: {
      feedback: feedback,
      responseRepair,
      direction: task.capture.source.paths.filter(
        (path) => path.startsWith(`${root}/goals/`) || path.startsWith(`${root}/objectives/`),
      ),
      findings,
      answers: architectAnswers(task),
      response: responseShape(),
    },
  };
}

/** Preserve the complete answer and its host evidence instead of reducing it to a status. */
function architectAnswers(task: HostTask) {
  return task
    .observations<{
      projectReply?: {
        answer: string;
        scope: string;
        question: string;
        owner: string;
        evidence: readonly string[];
      };
    }>()
    .flatMap(({ projectReply }) => (projectReply ? [projectReply] : []));
}

/** Describe assessment outputs while leaving research and questions to the mapped MCP tools. */
function responseShape() {
  return {
    noChange: {
      kind: 'no-change',
      summary: 'Explain alignment with accepted direction and findings',
      evidence: [{ path: 'captured path', quote: 'exact source excerpt' }],
    },
    proposal: {
      kind: 'proposal',
      purpose: 'Intended architectural change',
      consequences: ['Effects and tradeoffs'],
      implementation: ['Prerequisite implementation outcomes, or an empty list'],
      changes: [{ path: 'guide path', content: 'Complete UTF-8 content, or null for deletion' }],
    },
  };
}
