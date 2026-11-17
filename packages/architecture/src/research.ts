import { parse } from 'yaml';
import type { Capture } from './catalog.js';

/** Resolve the component's research archive under the captured knowledge root. */
export function researchDirectory(capture: Capture, component: string) {
  return `${capture.project.knowledgeRoot ?? '.arc'}/research/${component}`;
}

/** Research is selectable only when the component declares a read-only model activity. */
export function canResearch(capture: Capture, component: string) {
  const research = capture.components[component]?.activities.research;
  return !!research?.profile && !research.executor && research.operations?.length === 0;
}

/** Derive a compact component index from the summaries committed with the reports. */
export function researchIndex(capture: Capture, component: string) {
  const directory = researchDirectory(capture, component);
  const reports = capture.source.paths.flatMap((path) => {
    const name = path.slice(directory.length + 1);
    if (!path.startsWith(directory + '/') || !/^[a-f0-9]{64}\.md$/.test(name)) return [];
    const entry = reportSummary(capture.source.read(path));
    return entry ? [{ path, ...entry }] : [];
  });
  reports.sort(
    (left, right) =>
      right.consulted.localeCompare(left.consulted) || left.path.localeCompare(right.path),
  );
  return { directory, total: reports.length, recent: reports.slice(0, 8) };
}

/** Read only the report's index fields and skip files with malformed metadata. */
function reportSummary(markdown: string) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)?.[1];
  if (!frontmatter) return;
  try {
    const data = parse(frontmatter) as {
      question?: unknown;
      summary?: unknown;
      consulted?: unknown;
    } | null;
    if (
      typeof data?.question === 'string' &&
      typeof data.summary === 'string' &&
      typeof data.consulted === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.consulted)
    )
      return {
        question: data.question.slice(0, 500),
        summary: data.summary.slice(0, 600),
        consulted: data.consulted,
      };
  } catch {
    return undefined;
  }
}
