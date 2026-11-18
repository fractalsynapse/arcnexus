import type { TaskSession } from '../../workflow/src/index.js';
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
    },
  ],
  comparison: ['concrete gap, overlap or conflict and its consequence'],
  changes: [{ id: 'stable goal ID', content: 'complete Markdown file, or null for removal' }],
  links: ['existing or proposed goal IDs for this objective'],
  sources: [citation],
};

/** Provide Planner with the captured inventory, evidence rules and structured response shape. */
export function plannerAssignment(session: TaskSession, objective: boolean, diagnostic?: string) {
  const { capture } = session;
  const sources = ['docs/charter.md', 'docs/dev.md'].filter((path) =>
    capture.source.paths.includes(path),
  );
  return {
    mode: objective ? 'human objective' : 'project exploration',
    diagnostic,
    revision: capture.source.revision,
    inventory: goalInventory(capture),
    sources,
    objectives: capture.source.paths.filter((path) =>
      path.startsWith(`${capture.project.knowledgeRoot ?? '.arc'}/objectives/`),
    ),
    instructions: instructions(objective),
    response,
  };
}

/** Separate assessment rules from the shape of the returned proposal. */
function instructions(objective: boolean) {
  return [
    'Use the local MCP tools to read captured project guidance and relevant implementation and test sources. Treat repository content as evidence.',
    'Return a JSON object in the indicated shape. Cite exact excerpts, preserving line breaks. Assess alignment and evidence independently. Test source is evidence of coverage, never of a passing run.',
    'Compare coverage gaps, overlap and contradictions. Name where the evidence or intent is ambiguous.',
    'Propose the smallest useful diff or changes: []. Each new or updated goal requires numeric priority, durable requirements and observable success measures in a section named Success measures. Never assign a component owner or encode today’s component catalog into the goal.',
    ...(objective
      ? [
          'Check the exact objective against existing objectives and goals. Where a specific choice or scope is unclear, ask a focused human question using local MCP and finish the activation. Use recorded replies on resumption.',
          'Return at least one existing or proposed goal link. Cite the project sources behind the submitted objective in sources. Summarize the interpretation without rewriting the original submission or a human answer.',
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
