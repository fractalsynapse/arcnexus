import type { Document } from 'yaml';
import { z } from 'zod';
import type { DesignFile } from './model.ts';

export type YamlPath = (string | number)[];
type YamlIssue = { path: readonly PropertyKey[]; message: string };

export function hasYamlForm(file: DesignFile) {
  return file.area === 'architect' && (file.type === 'Component' || file.type === 'Operation');
}

function text(label: string) {
  return z.string().refine((value) => Boolean(value.trim()), {
    error: `Enter ${label}.`,
  });
}

const name = text('a name');
const purpose = text('a value for purpose');
const strings = z.array(name);
const parameterValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
const parameterValues = z.record(name, parameterValue);
const argument = z.union([
  z.string(),
  z.strictObject({ context: z.literal('owner') }),
  z.strictObject({ parameter: name }),
]);
const parameter = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('array'),
    items: z.strictObject({ type: z.literal('string') }),
    default: z.array(z.string()).optional(),
  }),
  z.strictObject({ type: z.literal('string'), default: z.string().optional() }),
  z.strictObject({ type: z.literal('number'), default: z.number().optional() }),
  z.strictObject({ type: z.literal('boolean'), default: z.boolean().optional() }),
]);

const removedOperationFields = ['applicability', 'category'];

export const operationSchema = z
  .strictObject(
    {
      id: name,
      kind: z.enum(['command', 'tool']),
      tool: name.optional(),
      purpose,
      command: text('a value for command').optional(),
      cwd: text('a value for working directory').optional(),
      network: z.boolean({ error: 'Network access must be true or false.' }).optional(),
      args: z.array(argument).optional(),
      parameters: z.record(name, parameter).optional(),
    },
    {
      error: (issue) =>
        issue.code === 'unrecognized_keys' &&
        issue.keys.every((key) => removedOperationFields.includes(key))
          ? `Delete ${issue.keys.join(' and ')} from the draft.`
          : undefined,
    },
  )
  .superRefine((value, ctx) => {
    if (value.kind === 'command' && !value.command)
      ctx.addIssue({ code: 'custom', path: ['command'], message: 'Enter a value for command.' });
    if (value.kind === 'tool' && !value.tool)
      ctx.addIssue({ code: 'custom', path: ['tool'], message: 'Specify a handler in Raw.' });
    value.args?.forEach((arg, index) => {
      if (
        typeof arg === 'object' &&
        'parameter' in arg &&
        !Object.hasOwn(value.parameters ?? {}, arg.parameter)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['args', index],
          message: `Unknown parameter ${arg.parameter}.`,
        });
    });
  });

const binding = z.union([
  name,
  z.strictObject({ operation: name, parameters: parameterValues.optional() }),
]);
const activity = z
  .looseObject({
    role: name,
    executor: z.literal('host').optional(),
    profile: name.optional(),
    instructions: z.array(text('an instruction')).nonempty('Enter at least one instruction.'),
    operations: z.array(binding),
    standards: strings,
    verification: strings.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.executor && !value.profile)
      ctx.addIssue({
        code: 'custom',
        path: ['profile'],
        message: 'Enter a profile for the agent.',
      });
    if (value.executor && value.profile)
      ctx.addIssue({
        code: 'custom',
        path: ['profile'],
        message: 'Remove the profile from the host activity in Raw.',
      });
    for (const issue of activityReferences(value)) ctx.addIssue({ code: 'custom', ...issue });
  });

function activityReferences(value: Pick<Activity, 'operations' | 'verification'>) {
  const issues: { path: YamlPath; message: string }[] = [];
  const ids = new Set<string>();
  value.operations.forEach((binding, i) => {
    const id = typeof binding === 'string' ? binding : binding.operation;
    if (ids.has(id))
      issues.push({
        path: typeof binding === 'string' ? ['operations', i] : ['operations', i, 'operation'],
        message: `Operation ${id} is already granted.`,
      });
    ids.add(id);
  });
  value.verification?.forEach((id, i) => {
    if (!ids.has(id))
      issues.push({
        path: ['verification', i],
        message: `Grant ${id} in Operations first.`,
      });
  });
  return issues;
}

export const activityLists = { sequence: 'Milestone sequence', requested: 'On request' } as const;
export type ActivityList = keyof typeof activityLists;

const activityFlow = z.strictObject({ sequence: strings, requested: strings });

export const componentSchema = z
  .looseObject({
    id: name,
    kind: z.enum(['plugin', 'app', 'project']),
    purpose,
    summary: z.string().optional(),
    objectives: z.array(z.looseObject({ measure: text('a measure') })).optional(),
    constraints: z.array(z.looseObject({ failure: text('a failure condition') })).optional(),
    owns: strings,
    activities: z.record(name, activity).refine((value) => Object.keys(value).length > 0, {
      error: 'Declare at least one activity in Raw.',
    }),
    activityFlow: activityFlow.optional(),
    operationParameters: z.record(name, parameterValues).optional(),
  })
  .superRefine((component, ctx) => {
    if (!component.activityFlow) return;
    const assigned = new Map<string, ActivityList>();
    for (const list of ['sequence', 'requested'] as const) {
      component.activityFlow[list].forEach((id, index) => {
        const previous = assigned.get(id);
        if (!Object.hasOwn(component.activities, id))
          ctx.addIssue({
            code: 'custom', path: ['activityFlow', list, index], message: `Unknown activity ${id}.`,
          });
        else if (previous)
          ctx.addIssue({
            code: 'custom', path: ['activityFlow', list, index], message: `${id} is already in ${activityLists[previous]}.`,
          });
        assigned.set(id, previous ?? list);
      });
    }
  });

export type Operation = z.infer<typeof operationSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Activity = z.infer<typeof activity>;
export type ParameterValue = z.infer<typeof parameterValue>;

export function defaultActivityFlow(activities: Component['activities']) {
  return {
    sequence: ['documentation', 'testing', 'implementation', 'review', 'release'].filter((id) =>
      Object.hasOwn(activities, id),
    ),
    requested: Object.hasOwn(activities, 'research') ? ['research'] : [],
  };
}

export function prepareComponentDraft(document: Document) {
  if (document.has('activityFlow')) return false;
  try {
    const result = componentSchema.safeParse(document.toJS());
    if (!result.success) return false;
    document.set('activityFlow', document.createNode(defaultActivityFlow(result.data.activities)));
    return true;
  } catch {
    return false;
  }
}

export function yamlIssues(document: Document, file: DesignFile): readonly YamlIssue[] {
  if (document.errors.length) return document.errors.map(({ message }) => ({ path: [], message }));
  try {
    const schema = file.type === 'Operation' ? operationSchema : componentSchema;
    const result = schema.safeParse(document.toJS());
    if (!result.success) return result.error.issues;
    const expected = file.path
      .split('/')
      .at(-1)
      ?.replace(/\.ya?ml$/, '');
    return result.data.id === expected
      ? []
      : [{ path: ['id'], message: `The ID must match the file name (${expected}).` }];
  } catch (error) {
    return [{ path: [], message: error instanceof Error ? error.message : String(error) }];
  }
}

const operationPurposes: Readonly<Record<string, string>> = {
  'archive-research':
    'Archive a completed research report so other activities can reuse its findings.',
  'ask-question': 'Ask the human architect for a decision or information needed to continue.',
  'checked-edit':
    'Change one owned file and record its checked edit against the expected preimage.',
  'list-files': 'List files in one project directory to locate source, guides, or evidence.',
  'owner-format': 'Check formatting for the current component’s owned files.',
  'owner-lint': 'Run lint checks on the current component’s owned files.',
  'owner-tests':
    'Run the current component’s tests using its configured selectors to verify behavior changes.',
  'read-file': 'Read a complete project file or retained evidence and get its content hash.',
  'repository-build': 'Build the repository to check that its packages assemble successfully.',
  'repository-format': 'Check formatting across maintained repository files.',
  'repository-lint': 'Run the lint checks for the assembled repository.',
  'repository-tests': 'Run the repository test suites for assembled verification.',
  'repository-types': 'Check TypeScript types across the repository.',
  'request-research': 'Request research when outside evidence could change an activity decision.',
  'request-supplier':
    'Ask Direction to sequence work from the component that owns the needed contribution.',
};

export function prepareOperationDraft(document: Document) {
  const retired = removedOperationFields.filter((field) => document.has(field));
  for (const field of retired) document.delete(field);
  const id = document.get('id');
  const addPurpose =
    !document.has('purpose') && typeof id === 'string' && Object.hasOwn(operationPurposes, id);
  if (addPurpose) document.set('purpose', operationPurposes[id]);
  return retired.length > 0 || addPurpose;
}
