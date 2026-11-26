import { highlightCode, renderMarkdown } from '../../../packages/ui/src/content/markdown.js';
import { splitMarkdown } from '../../../packages/foundation/src/markdown-document.js';

export { splitMarkdown };

export function markdownContent(source: string, editing: boolean) {
  if (editing) return '<div class="arc-md-edit" data-md-editor></div>';
  return markdownViewer(splitMarkdown(source).body);
}

export function markdownViewer(body: string) {
  return '<article class="arc-markdown arc-md-view">' + renderMarkdown(body) + '</article>';
}

export function highlightFileCode(parent: HTMLElement) {
  for (const block of parent.querySelectorAll<HTMLElement>('.arc-code-view pre code')) {
    const language = [...block.classList].find((name) => name.startsWith('language-'))?.slice(9);
    const highlighted = language && highlightCode(block.textContent ?? '', language);
    if (highlighted) block.innerHTML = highlighted;
  }
}
