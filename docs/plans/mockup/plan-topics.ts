import type { DesignFile } from './model.ts';

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
  if (item.area !== 'plan') return;
  for (const revision of item.revisions) {
    if (revision.topics.length) continue;
    const goals =
      item.type === 'Goal'
        ? [fileName(item.path)]
        : [...(revision.content.split('---')[1] ?? '').matchAll(/^\s*- id: (\S+)/gm)].map(
            (match) => match[1] ?? '',
          );
    revision.topics = [...new Set(goals.flatMap((id) => examples[id] ?? []))].sort();
  }
}
