import { z } from 'zod';

const directory = z
  .string()
  .refine(
    (value) =>
      value === value.trim() &&
      value
        .split('/')
        .every(
          (part) =>
            part &&
            !['.', '..', '.git'].includes(part) &&
            !part.includes('\\') &&
            !part.includes('\0'),
        ),
    'Use a repository-relative directory',
  );

export const documentationDirectories = z
  .array(directory)
  .refine(
    (paths) => new Set(paths).size === paths.length,
    'List each documentation directory once',
  );

export const documentationSettings = z.strictObject({
  revision: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
  directories: documentationDirectories,
});

export type DocumentationSettings = z.output<typeof documentationSettings>;
