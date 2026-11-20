import type { TaskSession } from '../../workflow/src/index.js';
import { objectiveDirectory, refinement } from './records.js';
import type { VerifiedGoalRun } from '../../execution/src/index.js';
import { goalDirectory, goalInventory } from './inventory.js';

const citation = { path: 'exact repository-relative path', quote: 'verbatim excerpt' };

const response = {
  summary: 'concise reason for the disposition',
  ratings: [
    {
      id: 'existing goal ID',
      alignment: 'strong | partial | unmapped',
      evidence: 'demonstrated | partial | unverified',
      reason: 'explain alignment AND evidence, including missing evidence',
      sources: [citation],
      observations: [citation],
      run: {
        run: 'verified run id',
        operation: 'observed operation id, or use criterion or delivery: true',
      },
    },
  ],
  comparison: ['concrete gap, overlap or conflict and its consequence'],
  changes: [{ id: 'stable goal ID', content: 'complete Markdown file, or null for removal' }],
  links: ['existing or proposed goal IDs for this objective'],
  sources: [citation],
};

/** Provide Planner with the captured inventory, evidence rules and structured response shape. */
export function plannerAssignment(session: TaskSession, objective: boolean, run?: VerifiedGoalRun) {
  const { capture } = session;
  const sources = ['docs/charter.md', 'docs/dev.md'].filter((path) =>
    capture.source.paths.includes(path),
  );
  return {
    mode: objective ? 'human objective' : 'project exploration',
    verifiedRun: run,
    diagnostic: undefined as string | undefined,
    refines: objective ? refinement(session) : undefined,
    revision: capture.source.revision,
    inventory: goalInventory(capture),
    sources,
    objectives: capture.source.paths.filter((path) =>
      path.startsWith(objectiveDirectory(session) + '/'),
    ),
    instructions: instructions(objective),
    response,
  };
}

/** Separate assessment rules from the shape of the returned proposal. */
function instructions(objective: boolean) {
  return [
    'Use the local MCP tools to read captured project guidance and relevant implementation and test sources. Treat repository content as evidence.',
    'Return a JSON object in the indicated shape. Cite exact excerpts, preserving line breaks. Assess alignment and evidence independently. For a demonstrated rating cite the verified run and the operation, criterion, or delivery observation. Name which check or independently reviewed criterion supports the measure. Use a partial or unverified rating when the observations do not establish the measure. Test source is evidence of coverage.',
    'If review findings are present, correct them against the current candidate and propose complete replacement bytes for affected goals. Preserve the exact requested objective and human answers.',
    'Compare coverage gaps, overlap and contradictions. Name where the evidence or intent is ambiguous.',
    'Propose the smallest useful diff or changes: []. Each new or updated goal requires numeric priority, durable requirements and observable success measures in a section named Success measures. Write durable requirements and success measures only. Keep observed results in the mapping report. Never assign a component owner or encode today’s component catalog into the goal.',
    ...(objective
      ? [
          'Check the exact objective against existing objectives and goals. Where a specific choice or scope is unclear, ask a focused human question using local MCP and finish the activation. Use recorded replies on resumption.',
          'Use existing or proposed goal ids when intent is compatible. Return empty links and changes if a conflict is unresolved or no goal can be mapped. Cite the project sources behind the submitted objective in sources. Summarize the interpretation without rewriting the original submission or a human answer.',
        ]
      : [
          'Rate every existing goal exactly once. Use the charter and development direction as starting points. Existing objectives may supply additional intent.',
          'Only propose a change grounded in current project evidence. Leave links empty in exploration.',
        ]),
  ];
}

/** Construct only the permitted captured inventory path for a validated goal ID. */
export function pathForGoal(session: TaskSession, id: string) {
  return `${goalDirectory(session.capture)}/${id}.md`;
}
