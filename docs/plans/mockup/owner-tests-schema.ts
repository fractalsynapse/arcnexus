import type { Document } from 'yaml';
import { z } from 'zod';

export const ownerTestsPath = '.arc/architecture/operations/owner-tests.yaml';
export const removedOperationFields = ['applicability', 'category'];
export const ownerTestsPurpose =
  'Run the current component’s tests using its configured selectors to verify behavior changes.';

function text(title: string, description: string) {
  return z
    .string()
    .refine((value) => Boolean(value.trim()), {
      error: `Enter a value for ${title.toLowerCase()}.`,
    })
    .meta({ title, description });
}

export const operationFields = {
  purpose: text('Purpose', 'Describe when Codex should choose this operation.'),
  command: text('Command', 'Executable name'),
  cwd: text('Working directory', 'Path relative to the repository root'),
};

const argument = z.union(
  [
    z.string(),
    z.strictObject({ context: z.literal('owner') }),
    z.strictObject({ parameter: z.literal('selectors') }),
  ],
  { error: 'Use literal text, the owner context, or the selectors parameter.' },
);

export const operationSchema = z.strictObject(
  {
    id: z.literal('owner-tests', { error: 'The ID must match the owner-tests file name.' }),
    kind: z.literal('command'),
    tool: z.literal('check'),
    network: z.literal(false, { error: 'Confined checks require network access to be disabled.' }),
    ...operationFields,
    args: z.array(argument),
    parameters: z.strictObject({
      selectors: z.strictObject({
        type: z.literal('array'),
        items: z.strictObject({ type: z.literal('string') }),
        default: z.array(z.string({ error: 'Enter a text selector.' })),
      }),
    }),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys' &&
      issue.keys.every((key) => removedOperationFields.includes(key))
        ? `Delete ${issue.keys.join(' and ')} from the draft.`
        : undefined,
  },
);

export type Operation = z.infer<typeof operationSchema>;
export type YamlPath = (string | number)[];
export type YamlIssue = { path: readonly PropertyKey[]; message: string };

export function operationIssues(document: Document): readonly YamlIssue[] {
  if (document.errors.length) return document.errors.map(({ message }) => ({ path: [], message }));
  try {
    const result = operationSchema.safeParse(document.toJS());
    return result.success ? [] : result.error.issues;
  } catch (error) {
    return [{ path: [], message: error instanceof Error ? error.message : String(error) }];
  }
}
