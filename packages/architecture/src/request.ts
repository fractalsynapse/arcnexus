import { stringify } from 'yaml';
import type { Manager } from '../../manager/src/index.js';
import { resolveActivity, type ActivitySelection } from './activity.js';
import { catalogRoot, definitionPath, type Capture } from './catalog.js';

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
function renderContext(request: RequestContext) {
  const { capture, selected, context } = request;
  const project = {
    actor: selected.actor,
    activity: selected.name,
    revision: capture.source.revision,
    project: capture.project,
  };
  return [
    section('Actor and project', `${catalogRoot}/project.yaml`, project),
    renderTask(context),
    ...renderActivity(request),
    ...renderResources(request),
  ];
}

/** Show the selected component's instructions and where it gets its authority. */
function renderActivity({ selected, references }: RequestContext) {
  const { component, name, actor } = selected;
  const { role, profile, standards, operations } = references;
  const componentPath = definitionPath('components', component.id);
  const activitySource = `Activity ${name} in ${componentPath}`;
  return [
    section('Component', componentPath, component),
    section('Role', definitionPath('roles', role.id), role),
    section('Model profile', definitionPath('execution-profiles', profile.id), profile),
    section(
      'Capabilities',
      `Derived from the ${actor} actor binding and ${activitySource}`,
      capabilityScope(actor, name, component.owns),
    ),
    section('Operations', activitySource, renderOperations(operations)),
    section('Standards', activitySource, renderStandards(standards)),
  ];
}

/** Resolve the captured documents and discovery indexes visible to the component. */
function renderResources({ capture, manager, selected, context }: RequestContext) {
  const { component } = selected;
  const skills = typeof context.skills === 'string' ? [] : context.skills;
  return [
    section(
      'Resolved guidance',
      'Captured project guidance for the component’s owned roots and selected skills',
      renderGuidance(manager.guidanceFor(capture.source, component.owns, skills)),
    ),
    section(
      'Contract context',
      capture.project.contractRegistry,
      contractsFor(capture, component.id),
    ),
    section('Component index', `${catalogRoot}/components/`, componentIndex(capture, component.id)),
  ];
}

/** Show the goal in place, followed by the remaining task inputs. */
function renderTask({ goal, ...context }: RequestContext['context']) {
  return section(
    'Task',
    'Task inputs supplied at activation',
    `Goal: ${goal}\n\n${renderData(context)}`,
  );
}

/** Identify the file granting each operation its definition. */
function renderOperations(operations: RequestContext['references']['operations']) {
  return operations.map((operation) => ({
    source: definitionPath('operations', operation.id),
    definition: operation,
  }));
}

/** Render each standard's catalog entry beside its complete document. */
function renderStandards(standards: RequestContext['references']['standards']) {
  return (
    standards
      .map(({ text, ...standard }) =>
        [
          `Source: ${definitionPath('standards', standard.id)}`,
          renderData(standard),
          document(standard.document, text),
        ].join('\n'),
      )
      .join('\n\n') || 'None'
  );
}

/** Include complete scoped directives and distinguish skill metadata from selected text. */
function renderGuidance({ directives, skills }: ReturnType<Manager['guidanceFor']>) {
  const scoped = directives.map(({ path, text }) => document(path, text));
  const selected = skills.flatMap(({ path, text }) =>
    text === undefined ? [] : [document(path, text)],
  );
  return [
    '### Directives',
    scoped.join('\n\n') || 'None',
    '### Discoverable skills',
    renderData(skills.map(({ name, description, path }) => ({ name, description, path }))),
    '### Selected skill content',
    selected.join('\n\n') || 'None',
  ].join('\n\n');
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
  const index = capture.contracts.map(({ id, file, owner, stage, digest }) => ({
    id,
    file,
    owner,
    stage,
    digest,
  }));
  const applicable = capture.contracts
    .filter((entry) => entry.owner === owner || entry.id.endsWith('/project'))
    .map(({ file }) => document(file, capture.source.read(file)));
  return [
    '### Contract registry index',
    renderData(index),
    '### Applicable contracts',
    applicable.join('\n\n') || 'None',
  ].join('\n\n');
}

/** Keep other owners discoverable without including their full activity definitions. */
function componentIndex(capture: Capture, current: string) {
  return Object.values(capture.components)
    .filter(({ id }) => id !== current)
    .map(({ id, purpose }) => ({
      id,
      purpose,
      definition: definitionPath('components', id),
    }));
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
