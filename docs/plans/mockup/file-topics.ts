import type { DesignFile, Revision } from './model.ts';

const examples: Record<string, string[]> = {
  'inspect-parity': ['Agent inspection', 'MCP'],
  'owner-test-selection': ['Ownership', 'Verification'],
  'recover-moved-staging': ['Delivery', 'Recovery'],
  'recover-reviewed-steward-holds': ['Recovery', 'Review'],
  'recover-steward-checkpoints': ['Checkpoints', 'Recovery'],
  'reviewed-staging-tree': ['Delivery', 'Review'],
  'trace-verified-observations': ['Evidence', 'Verification'],
  'unique-ownership': ['Architecture', 'Ownership'],
};

export function fileName(path: string) {
  return (path.split('/').at(-1) ?? path).replace(/\.[^.]+$/, '');
}

export function previewTopics(item: DesignFile) {
  for (const revision of item.revisions) {
    if (revision.topics.length) continue;
    if (item.area === 'architect') {
      revision.topics = architectureTopics(item, revision);
      continue;
    }
    const goals =
      item.type === 'Goal'
        ? [fileName(item.path)]
        : [...(revision.content.split('---')[1] ?? '').matchAll(/^\s*- id: (\S+)/gm)].map(
            (match) => match[1] ?? '',
          );
    revision.topics = [...new Set(goals.flatMap((id) => examples[id] ?? []))].sort();
  }
}

const componentTopics: Record<string, string> = {
  agent: 'Agent lifecycle',
  architecture: 'Ownership',
  direction: 'Agent lifecycle',
  execution: 'Agent lifecycle',
  planner: 'Planning',
  reviewer: 'Verification',
  verification: 'Verification',
  workflow: 'Agent lifecycle',
  delivery: 'Delivery',
  release: 'Delivery',
};

function architectureTopics(item: DesignFile, revision: Revision) {
  const name = fileName(item.path);
  if (item.type === 'Standard')
    return [name === 'readable-typescript' ? 'TypeScript' : 'Agent guidance'];
  if (item.type === 'Component') {
    return componentTopics[name] ? [componentTopics[name]] : [];
  }
  const category = revision.content.match(/^category: ([\w-]+)$/m)?.[1];
  return category
    ? [category.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase())]
    : [];
}
