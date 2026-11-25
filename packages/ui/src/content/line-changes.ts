import { structuredPatch, type StructuredPatchHunk } from 'diff';

export type DiffLine = [kind: string, text: string, before?: number, after?: number];

/** Keep each change and its neighboring context in a numbered unified hunk. */
export function textChanges(before: string, after: string) {
  return structuredPatch('', '', before, after, undefined, undefined, { context: 3 }).hunks.flatMap(
    hunkChanges,
  );
}

function hunkChanges(hunk: StructuredPatchHunk): DiffLine[] {
  const oldRange = hunkRange(hunk.oldStart, hunk.oldLines);
  const newRange = hunkRange(hunk.newStart, hunk.newLines);
  return [
    ['hunk', `@@ -${oldRange} +${newRange} @@`],
    ...numberPatchLines(hunk.lines, hunk.oldStart, hunk.newStart),
  ];
}

function hunkRange(start: number, length: number) {
  return (length ? start : start - 1) + ',' + length;
}

/** Number both sides of a hunk when its original coordinates are known. */
export function numberPatchLines(
  lines: readonly string[],
  before?: number,
  after?: number,
): DiffLine[] {
  return lines.map((line) => {
    const kind = { '+': 'added', '-': 'removed', ' ': 'context' }[line.charAt(0)];
    if (!kind) return [line.startsWith('\\') ? 'note' : 'context', line];
    const oldLine = kind === 'added' ? undefined : before;
    const newLine = kind === 'removed' ? undefined : after;
    if (oldLine !== undefined) before = oldLine + 1;
    if (newLine !== undefined) after = newLine + 1;
    return [kind, line, oldLine, newLine];
  });
}
