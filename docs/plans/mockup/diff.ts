import { escape, noData, panel } from './view.ts';

type DiffLine = [kind: string, text: string];

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
  const lines: DiffLine[] = [];
  let hunk = false;
  for (const line of source.replace(/\r?\n$/, '').split(/\r?\n/)) {
    if (line.startsWith('@@')) {
      hunk = true;
      lines.push(['hunk', line]);
    } else if (hunk && line.startsWith('+')) lines.push(['added', line]);
    else if (hunk && line.startsWith('-')) lines.push(['removed', line]);
    else if (hunk || !/^(diff --git |index |--- |\+\+\+ )/.test(line)) {
      lines.push(['context', line]);
    }
  }
  return lines;
}

export function diffView(
  label: string,
  files: FileDelta[],
  { localPatch = false, heading = 'Changes', action = '' } = {},
) {
  const caption = `<div class="arc-row"><small>${escape(label)}</small>${action}</div>`;
  if (!files.length) return panel(heading, noData('No changed files recorded.'), caption);
  return panel(heading, diffBody(files, localPatch), caption);
}

export function diffBody(files: FileDelta[], localPatch = false) {
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

export function draftDiff(before: string[], after: string[]): DiffLine[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return [
    ['hunk', `@@ Draft changes from line ${start + 1}`],
    ...before.slice(start, oldEnd).map<DiffLine>((line) => ['removed', '− ' + line]),
    ...after.slice(start, newEnd).map<DiffLine>((line) => ['added', '+ ' + line]),
  ];
}

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
  const legend = `<div class="arc-diff-legend"><span class="added">+${added} additions</span>
    <span class="removed">−${removed} deletions</span></div>`;
  return (
    note +
    legend +
    '<pre class="arc-diff arc-patch">' +
    file.lines
      .map(([kind, line]) => `<span class="${kind}">${escape(line) || ' '}</span>`)
      .join('') +
    '</pre>'
  );
}

export function selectDiffTab(tab: HTMLButtonElement) {
  const viewer = tab.closest('.arc-file-diff');
  if (!viewer) return;
  viewer.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((button) => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const selected = tab.getAttribute('aria-controls');
  viewer.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach((content) => {
    content.hidden = content.id !== selected;
  });
  tab.focus();
}

export function navigateDiffTabs(event: KeyboardEvent, tab: HTMLButtonElement) {
  const tabs = [...(tab.parentElement?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  const current = tabs.indexOf(tab);
  const candidate = {
    ArrowUp: (current - 1 + tabs.length) % tabs.length,
    ArrowDown: (current + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }[event.key];
  if (candidate === undefined || !tabs[candidate]) return;
  event.preventDefault();
  selectDiffTab(tabs[candidate]);
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
