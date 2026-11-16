import type { Manager } from '../../manager/src/index.js';
import { resolveActivity, type ActivitySelection } from './activity.js';
import type { Capture } from './catalog.js';

export interface TaskContext {
  goal?: string;
  milestone?: unknown;
  acceptance?: readonly unknown[];
  evidence?: readonly unknown[];
  worktree?: string;
  skills?: readonly string[];
}

/** Assemble the sole model request for both inspection and a task activation. */
export function buildCodexRequest(
  manager: Manager,
  capture: Capture,
  selection: ActivitySelection,
  task: TaskContext = {},
) {
  const selected = resolveActivity(capture, selection);
  const { component, name, actor } = selected;
  const references = resolveReferences(capture, selected);
  const { context, placeholders } = resolveTask(task);
  const sections = renderContext({ manager, capture, selected, context, references });
  if (actor === 'director') {
    sections.push(section('Plan template', capture.source.read(capture.project.planTemplate)));
  }
  return {
    actor,
    component: component.id,
    activity: name,
    placeholders,
    request: {
      input: sections.join('\n\n'),
      options: modelOptions(references.profile, context.worktree),
    },
  };
}

/** Translate the captured profile and workspace into harness options. */
function modelOptions(profile: ReturnType<typeof resolveReferences>['profile'], worktree: string) {
  return {
    model: profile.model,
    modelReasoningEffort: profile.reasoning,
    webSearchMode: profile.webSearch,
    workingDirectory: worktree,
  };
}

interface RequestContext {
  manager: Manager;
  capture: Capture;
  selected: ReturnType<typeof resolveActivity>;
  context: ReturnType<typeof resolveTask>['context'];
  references: ReturnType<typeof resolveReferences>;
}

/** Serialize the resolved context in the same order for all callers. */
function renderContext({ manager, capture, selected, context, references }: RequestContext) {
  const { component, name, actor } = selected;
  const { role, profile, standards, operations } = references;
  const scope = capabilityScope(actor, name, component.owns);
  const guidance = manager.guidanceFor(
    capture.source,
    component.owns,
    typeof context.skills === 'string' ? [] : context.skills,
  );
  return [
    section('Actor and project', {
      actor,
      activity: name,
      revision: capture.source.revision,
      project: capture.project,
    }),
    section('Task', context),
    section('Component', component),
    section('Role', role),
    section('Model profile', profile),
    section('Capabilities', scope),
    section('Operations', operations),
    section('Standards', standards),
    section('Resolved guidance', guidance),
    section('Contract context', contractsFor(capture, component.id)),
    section('Component index', componentIndex(capture, component.id)),
  ];
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
    return { ...standard, text: capture.source.read(standard.document) };
  });
  const operations = activity.operations.map((id) => {
    const operation = reference(capture.operations, id, 'operation');
    if (!profile.operationCategories.includes(operation.category)) {
      throw new Error(`Operation ${id} is outside profile ${profile.id} categories`);
    }
    return operation;
  });
  return { role, profile, standards, operations };
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
    goal: task.goal ?? '<goal>',
    milestone: task.milestone ?? '<milestone>',
    acceptance: task.acceptance ?? '<acceptance>',
    evidence: task.evidence ?? '<evidence>',
    worktree: task.worktree ?? '<worktree>',
    skills: task.skills ?? '<skills>',
  };
  for (const name of Object.keys(context) as (keyof typeof context)[]) {
    if (task[name] === undefined) placeholders.push(`<${name}>`);
  }
  return { context, placeholders };
}

/** Report the capabilities granted to the actor for the chosen activity. */
function capabilityScope(actor: string, activity: string, owns: readonly string[]) {
  const mayEdit =
    actor === 'steward' && ['documentation', 'testing', 'implementation'].includes(activity);
  return {
    observations:
      actor === 'reviewer'
        ? ['captured project', 'candidate and task evidence by reference']
        : ['captured project', 'recorded task position and answers'],
    checkedEditRoots: mayEdit ? owns : [],
    canRequestSupplier: actor === 'steward' || actor === 'director',
    canPublish: false,
  };
}

/** Include complete applicable contracts and identify other contracts by reference. */
function contractsFor(capture: Capture, owner: string) {
  return {
    index: capture.contracts.map(({ id, file, owner, stage, digest }) => ({
      id,
      file,
      owner,
      stage,
      digest,
    })),
    applicable: capture.contracts
      .filter((entry) => entry.owner === owner || entry.id.endsWith('/project'))
      .map(({ id, file }) => ({ id, file, text: capture.source.read(file) })),
  };
}

/** Keep other owners discoverable without including their full activity definitions. */
function componentIndex(capture: Capture, current: string) {
  return Object.values(capture.components)
    .filter(({ id }) => id !== current)
    .map(({ id, purpose }) => ({
      id,
      purpose,
      definition: `.arc/architecture/components/${id}.yaml`,
    }));
}

/** Render a named input section without dropping or truncating content. */
function section(name: string, content: unknown) {
  return `## ${name}\n${typeof content === 'string' ? content : JSON.stringify(content, null, 2)}`;
}
