import { diffArrays, diffLines } from 'diff';

export type DiffLine = [kind: string, text: string];

export function textChanges(before: string, after: string) {
  return diffLines(before, after).flatMap((part) =>
    lines({ ...part, value: part.value.replace(/\n$/, '').split('\n') }),
  );
}

/** Build the same annotated lines for revision comparisons and editor drafts. */
export function lineChanges(before: string[], after: string[]): DiffLine[] {
  const parts = diffArrays(before, after);
  const first = parts.findIndex((part) => part.added || part.removed);
  if (first < 0) return [];
  const last = parts.findLastIndex((part) => part.added || part.removed);
  const startLine = (parts[first - 1]?.count ?? 0) + 1;
  return [
    ['hunk', '@@ Draft changes from line ' + startLine],
    ...parts.slice(first, last + 1).flatMap(lines),
  ];
}

function lines({ value, added, removed }: { value: string[]; added?: boolean; removed?: boolean }) {
  const [kind, prefix] = added ? ['added', '+ '] : removed ? ['removed', '− '] : ['context', '  '];
  return value.map<DiffLine>((line) => [kind, prefix + line]);
}
