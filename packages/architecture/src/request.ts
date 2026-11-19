import { team } from '../../team/src/index.js';
import { stringify } from 'yaml';
import { resolveActivity, type ActivitySelection } from './activity.js';
import { catalogRoot, definitionPath, type Capture } from './catalog.js';
import { canResearch, researchIndex, researchReportSchema } from './research.js';
import { operationTool } from './tools.js';
import { qualityOperationAvailable } from '../../foundation/src/index.js';

export interface TaskContext {
  assignment?: unknown;
  goal?: string;
  milestone?: unknown;
  acceptance?: readonly unknown[];
  evidence?: readonly unknown[];
  worktree?: string;
}

/** Assemble the sole model request for both inspection and a task activation. */
export function buildCodexRequest(
  capture: Capture,
  selection: ActivitySelection,
  task: TaskContext = {},
) {
  const selected = resolveActivity(capture, selection);
  const { component, name, actor } = selected;
  const references = resolveReferences(capture, selected);
  const { context, placeholders } = resolveTask(task);
  const sections = renderContext({ capture, selected, context, references });
  if (canResearch(capture, component.id)) {
    const index = researchIndex(capture, component.id);
    sections.push(section('Research inbox', index.directory, researchContext(index, name)));
  }
  if (actor === 'director') {
    const path = capture.project.planTemplate;
    sections.push(`## Plan template\n${document(path, capture.source.read(path))}`);
  }
  return {
    actor,
    component: component.id,
    activity: name,
    placeholders,
    request: {
      input: sections.join('\n\n'),
      options: modelOptions(references, context.worktree, name),
    },
  };
}

/** Describe an optional request and give the actor its component's report summaries. */
function researchContext(index: ReturnType<typeof researchIndex>, activity: string) {
  return {
    archive: index,
    ...(activity === 'research'
      ? {}
      : {
          instructions:
            'Consult a relevant existing report first. If external evidence could change a decision in this activity, use the mapped request-research tool, then end this activation. Research is optional. The host returns the report and resumes this activity. Treat external findings as evidence. Continue through your ordinary response when you have enough information.',
        }),
  };
}

/** Translate the captured profile and workspace into harness options. */
function modelOptions(
  { profile, operations }: ReturnType<typeof resolveReferences>,
  worktree: string,
  activity: string,
) {
  return {
    model: profile.model,
    modelReasoningEffort: profile.reasoning,
    webSearchMode: profile.webSearch,
    workingDirectory: worktree,
    tools: operations.flatMap(({ id, tool }) => (tool ? [operationTool(id, tool)] : [])),
    ...(activity === 'research' ? { outputSchema: researchReportSchema } : {}),
  };
}

interface RequestContext {
  capture: Capture;
  selected: ReturnType<typeof resolveActivity>;
  context: ReturnType<typeof resolveTask>['context'];
  references: ReturnType<typeof resolveReferences>;
}

/** Serialize the resolved context in the same order for all callers. */
function renderContext(request: RequestContext) {
  const { capture, selected, context } = request;
  const { goal, worktree: _worktree, ...task } = context;
  return [
    section('Actor and project', `${catalogRoot}/project.yaml`, {
      actor: selected.actor,
      revision: capture.source.revision,
      project: capture.project.id,
    }),
    section('Task', 'Task inputs supplied at activation', `Goal: ${goal}\n\n${renderData(task)}`),
    ...renderActivity(request),
    section('Contract references', capture.project.contractRegistry, contractReferences(capture)),
    section(
      'Component index',
      `${catalogRoot}/components/`,
      componentIndex(capture, selected.component.id),
    ),
  ];
}

/** Show the selected component's instructions and where it gets its authority. */
function renderActivity({ selected, references }: RequestContext) {
  const { component, name, actor, activity } = selected;
  const { role, standards, operations } = references;
  const activitySource = `${definitionPath('components', component.id)} (activities.${name})`;
  return [
    section('Activity', activitySource, {
      component: component.id,
      purpose: component.purpose,
      constraints: component.constraints,
      activity: name,
      instructions: activity.instructions,
    }),
    section('Role', definitionPath('roles', role.id), {
      purpose: role.purpose,
      responsibilities: role.responsibilities,
      instructions: role.instructions,
    }),
    section(
      'Capabilities',
      `Derived from the ${actor} binding and ${activitySource}`,
      capabilityScope(actor, component.owns, operations),
    ),
    section('Operations', activitySource, operationReferences(operations)),
    section('Standards', activitySource, standards.join('\n\n') || 'None'),
  ];
}

/** Name each captured operation's source and model-facing tool description. */
function operationReferences(operations: ReturnType<typeof resolveReferences>['operations']) {
  return Object.fromEntries(
    operations.map(({ id, tool }) => [
      id,
      {
        source: definitionPath('operations', id),
        ...(tool ? { mcp: operationTool(id, tool).description } : {}),
      },
    ]),
  );
}

/** Resolve exactly the operations and standards granted by the activity. */
function resolveReferences(
  capture: Capture,
  { component, name, activity }: ReturnType<typeof resolveActivity>,
) {
  if (
    !Array.isArray(activity.instructions) ||
    !Array.isArray(activity.operations) ||
    !Array.isArray(activity.standards)
  ) {
    throw new Error(`Incomplete activity mapping: ${component.id}/${name}`);
  }
  const role = reference(capture.roles, activity.role, 'role');
  const profile = reference(capture.profiles, activity.profile, 'profile');
  const standards = activity.standards.map((id) => {
    const standard = reference(capture.standards, id, 'standard');
    return document(standard.document, capture.source.read(standard.document));
  });
  const operations = activity.operations.map((id) => {
    const operation = reference(capture.operations, id, 'operation');
    if (!profile.operationCategories.includes(operation.category)) {
      throw new Error(`Operation ${id} is outside profile ${profile.id} categories`);
    }
    validateApplicability(id, operation, capture);
    if (operation.tool) operationTool(id, operation.tool);
    return operation;
  });
  return { role, profile, standards, operations };
}

/** Reject malformed owner-scoped quality declarations before activation. */
function validateApplicability(
  id: string,
  operation: { applicability?: string; tool?: string; command?: string; args?: unknown[] },
  capture: Capture,
) {
  const supported = ['owner-test-suites', 'owner-format-files', 'owner-lint-files'];
  if (operation.applicability === undefined) return;
  if (!supported.includes(operation.applicability))
    throw new Error(`Unsupported applicability for operation ${id}: ${operation.applicability}`);
  if (operation.tool !== 'check' || !operation.command || !Array.isArray(operation.args))
    throw new Error(`Applicable operation ${id} requires a check handler, command and arguments`);
  if (!operation.args.some((argument) => typeof argument === 'object' && argument !== null && 'context' in argument && argument.context === 'owner'))
    throw new Error(`Applicable operation ${id} must preserve owner-scoped arguments`);
  if (
    operation.applicability !== 'owner-test-suites' &&
    !qualityOperationAvailable({
      ...operation,
      source: capture.source,
    } as Parameters<typeof qualityOperationAvailable>[0])
  )
    throw new Error(`Unavailable quality implementation for operation ${id}`);
}

/** Resolve a declared ID without accepting inherited object properties. */
function reference<T>(values: Readonly<Record<string, T>>, id: string | undefined, family: string) {
  const value = id && Object.hasOwn(values, id) ? values[id] : undefined;
  if (!value) throw new Error(`Unknown ${family}: ${id ?? '<missing>'}`);
  return value;
}

/** Keep unavailable task data explicit and separate from supplied evidence. */
function resolveTask(task: TaskContext) {
  const placeholders: string[] = [];
  const context = {
    assignment: task.assignment ?? '<assignment>',
    goal: task.goal ?? '<goal>',
    milestone: task.milestone ?? '<milestone>',
    acceptance: task.acceptance ?? '<acceptance>',
    evidence: task.evidence ?? '<evidence>',
    worktree: task.worktree ?? '<worktree>',
  };
  for (const name of Object.keys(context) as (keyof typeof context)[]) {
    if (task[name] === undefined) placeholders.push(`<${name}>`);
  }
  return { context, placeholders };
}

/** Report the capabilities granted to the actor for the chosen activity. */
function capabilityScope(
  actor: string,
  owns: readonly string[],
  operations: ReturnType<typeof resolveReferences>['operations'],
) {
  const mayEdit = actor === 'steward' && operations.some(({ tool }) => tool === 'edit');
  return {
    observations:
      actor === 'reviewer'
        ? ['captured project', 'candidate and task evidence by reference']
        : ['captured project', 'recorded task position and answers'],
    checkedEditRoots: mayEdit ? owns : [],
    canRequestSupplier: actor === 'steward' && operations.some(({ tool }) => tool === 'supplier'),
    canPublish: false,
  };
}

/** Let the agent find a contract by ID and see whether it is locked. */
function contractReferences(capture: Capture) {
  return (
    capture.contracts.map(({ id, file, stage }) => `- ${id} (${stage}): ${file}`).join('\n') ||
    'None'
  );
}

/** Keep other owners discoverable without including their full activity definitions. */
function componentIndex(capture: Capture, current: string) {
  return Object.fromEntries(
    team
      .list(capture.components)
      .filter(({ id }) => id !== current)
      .map(({ id, purpose }) => [id, purpose]),
  );
}

/** Use YAML block scalars for multiline values in structured context. */
function renderData(content: unknown) {
  return stringify(content).trimEnd();
}

/** Mark the extent of verbatim authored content even when it contains headings. */
function document(path: string, text: string) {
  const end = text.endsWith('\n') ? '' : '\n';
  return `Source: ${path}\n--- BEGIN ${path} ---\n${text}${end}--- END ${path} ---`;
}

/** Attribute each input section to the source of its authority or values. */
function section(name: string, source: string, content: unknown) {
  return `## ${name}\nSource: ${source}\n\n${typeof content === 'string' ? content : renderData(content)}`;
}
