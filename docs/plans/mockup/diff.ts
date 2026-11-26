import { numberPatchLines, textChanges as draftDiff, type DiffLine } from '../../../packages/ui/src/content/line-changes.js';
import type { DiffSelection } from '../../../packages/ui/src/content/diff-selection.js';
import { commitReferences, escape, noData, panel } from './view.ts';

export type FileDelta = {
  path: string;
  lines: DiffLine[];
  note?: string;
};

let viewerId = 0;

export function readPatch(source: string, fallbackPath = ''): FileDelta[] {
  const boundary = /^diff --git /m.test(source)
    ? /(?=^diff --git )/m
    : /\r?\n\r?\n(?=--- (?:a\/[^\r\n]+|\/dev\/null)\r?\n\+\+\+ )/;
  return source.split(boundary).flatMap((section) => {
    const header = section.split(/^@@/m, 1)[0] ?? '';
    const path =
      header.match(/^\+\+\+ b\/(.+)$/m)?.[1] ??
      header.match(/^--- a\/(.+)$/m)?.[1] ??
      header.match(/^diff --git .* b\/(.+)$/m)?.[1] ??
      fallbackPath;
    if (!path || !section.trim()) return [];
    return [{ path, lines: patchLines(section) }];
  });
}

function patchLines(source: string): DiffLine[] {
  return source.replace(/\r?\n$/, '').split(/(?=^@@)/m).flatMap((section): DiffLine[] => {
    const lines = section.replace(/\r?\n$/, '').split(/\r?\n/);
    const [header = '', ...body] = lines;
    if (!header.startsWith('@@')) {
      return lines.filter((line) => !/^(diff --git |index |--- |\+\+\+ )/.test(line)).map((line) => ['context', line]);
    }
    const range = header.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    const rows = range ? numberPatchLines(body, Number(range[1]), Number(range[2])) : numberPatchLines(body);
    return [['hunk', header], ...rows];
  });
}

export function diffView(
  label: string,
  comparison: DiffSelection<FileDelta>,
  { localPatch = false, heading = 'Changes', action = '' } = {},
) {
  const caption = `<div class="arc-row"><small>${commitReferences(label)}</small>${action}</div>`;
  return panel(heading, diffBody(comparison, localPatch), caption);
}

export function diffBody({ file, files }: DiffSelection<FileDelta>, localPatch = false) {
  if (file) return `<div class="arc-file-diff">${diffContent(file)}</div>`;
  if (!files.length) return noData('No changed files recorded.');
  const id = 'arc-diff-' + ++viewerId;
  const selected = Math.max(
    0,
    files.findIndex((file) => file.lines.length),
  );
  const views = files.map((file, index) => fileTab(file, id + '-' + index, index === selected));
  const picker = localPatch
    ? '<label class="arc-diff-load">Open local patch<input type="file" data-patch-file accept=".diff,.patch,text/plain"></label><small role="status"></small>'
    : '';
  return `<div class="arc-file-diff">${picker}<div class="arc-diff-layout">
      <div role="tablist" aria-label="Changed files" aria-orientation="vertical">${views.map((view) => view.tab).join('')}</div>
      <div class="arc-diff-content">${views.map((view) => view.content).join('')}</div></div></div>`;
}

export { draftDiff };
export type { DiffLine };

function fileTab(file: FileDelta, id: string, selected: boolean) {
  const path = escape(file.path);
  return {
    tab: `<button type="button" role="tab" id="${id}-tab" aria-selected="${selected}"
      aria-controls="${id}-file" tabindex="${selected ? 0 : -1}">${path}</button>`,
    content: `<div role="tabpanel" id="${id}-file" aria-labelledby="${id}-tab"
      data-path="${path}" ${selected ? '' : 'hidden'}>${diffContent(file)}</div>`,
  };
}

function diffContent(file: FileDelta) {
  const note = file.note ? noData(file.note) : '';
  if (!file.lines.length) return note || noData('No text changes recorded for this file.');
  const added = file.lines.filter(([kind]) => kind === 'added').length;
  const removed = file.lines.filter(([kind]) => kind === 'removed').length;
  const legend = `<div class="arc-diff-legend arc-diff-lines"><span data-change="added">+${added} additions</span>
    <span data-change="removed">−${removed} deletions</span></div>`;
  return (
    note +
    legend +
    '<pre class="arc-diff arc-patch arc-diff-lines arc-numbered-diff">' +
    file.lines.map(diffRow).join('') +
    '</pre>'
  );
}

function diffRow([kind, line, before, after]: DiffLine) {
  const text = escape(line) || ' ';
  if (kind === 'hunk') return `<span data-change="hunk">${text}</span>`;
  const numbers = [before, after].map((number) => `<span class="arc-diff-number" aria-hidden="true">${number ?? ''}</span>`);
  return `<span class="arc-diff-row" data-change="${kind}">${numbers.join('')}<span class="arc-diff-code">${text}</span></span>`;
}

export async function loadDiffPatch(input: HTMLInputElement) {
  const picked = input.files?.[0];
  const viewer = input.closest('.arc-file-diff');
  const status = viewer?.querySelector('[role="status"]');
  if (!picked || !viewer || !status) return;
  try {
    const patches = new Map(readPatch(await picked.text()).map((file) => [file.path, file]));
    let loaded = 0;
    viewer.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach((tab) => {
      const file = patches.get(tab.dataset.path ?? '');
      if (!file) return;
      tab.innerHTML = diffContent(file);
      loaded++;
    });
    status.textContent = loaded
      ? `Patch loaded for ${loaded} changed files.`
      : 'No listed paths match this patch.';
  } catch {
    status.textContent = 'Could not read the selected patch.';
  }
}
