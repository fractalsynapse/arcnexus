import type { Document } from 'yaml';
import { z } from 'zod';

export const ownerTestsPath = '.arc/architecture/operations/owner-tests.yaml';

function text(title: string, description: string) {
  return z
    .string()
    .refine((value) => Boolean(value.trim()), {
      error: `Enter a value for ${title.toLowerCase()}.`,
    })
    .meta({ title, description });
}

export const operationFields = {
  command: text('Command', 'Executable name'),
  cwd: text('Working directory', 'Path relative to the repository root'),
  category: text('Category', 'Operation category used by execution profiles'),
  applicability: z
    .enum(['owner-test-suites', 'owner-format-files', 'owner-lint-files'], {
      error: 'Choose a supported applicability rule.',
    })
    .meta({
      title: 'Applicability',
      description: 'Which owner work makes this operation applicable',
    }),
  network: z
    .boolean({ error: 'Set network access to true or false.' })
    .meta({ title: 'Allow network access' }),
};

const argument = z.union(
  [
    z.string(),
    z.strictObject({ context: z.literal('owner') }),
    z.strictObject({ parameter: z.literal('selectors') }),
  ],
  { error: 'Use literal text, the owner context, or the selectors parameter.' },
);

export const operationSchema = z.strictObject({
  id: z.literal('owner-tests', { error: 'The ID must match the owner-tests file name.' }),
  kind: z.literal('command'),
  tool: z.literal('check'),
  ...operationFields,
  args: z.array(argument),
  parameters: z.strictObject({
    selectors: z.strictObject({
      type: z.literal('array'),
      items: z.strictObject({ type: z.literal('string') }),
      default: z.array(z.string({ error: 'Enter a text selector.' })),
    }),
  }),
});

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
