import highlight from 'highlight.js/lib/core';
import markdown from 'highlight.js/lib/languages/markdown';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';
import { escape } from './view.ts';

highlight.registerLanguage('markdown', markdown);
highlight.registerLanguage('json', json);
highlight.registerLanguage('typescript', typescript);
highlight.registerLanguage('yaml', yaml);

const parser = new Marked({
  renderer: {
    html({ text }) {
      return escape(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      return safeLink(href)
        ? `<a class="arc-link" href="${escape(href)}" data-arc-tooltip="${escape(title)}" aria-description="${escape(title)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
    },
    image({ text, href, title }) {
      const label = escape(text);
      return safeLink(href)
        ? `<a class="arc-link" data-md-image href="${escape(href)}" data-arc-tooltip="${escape(title)}" aria-description="${escape(title)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
    },
  },
});

function safeLink(url: string) {
  try {
    const protocol = new URL(url, 'https://arcnexus.invalid').protocol;
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

export function splitMarkdown(source: string) {
  const frontmatter =
    source.match(
      /^(?:\uFEFF)?---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/,
    )?.[0] ?? '';
  return { frontmatter, body: source.slice(frontmatter.length) };
}

export function markdownContent(source: string, editing: boolean) {
  if (editing) return '<div class="arc-md-edit" data-md-editor></div>';
  return markdownViewer(splitMarkdown(source).body);
}

export function markdownViewer(body: string) {
  const html = parser.parse(body, { async: false });
  return `<article class="arc-markdown arc-md-view">${html}</article>`;
}

export function highlightFileCode(parent: HTMLElement) {
  for (const block of parent.querySelectorAll<HTMLElement>(
    ':is(.arc-md-view,.arc-code-view) pre code',
  )) {
    const language = [...block.classList].find((name) => name.startsWith('language-'))?.slice(9);
    if (language && highlight.getLanguage(language)) {
      block.innerHTML = highlight.highlight(block.textContent ?? '', { language }).value;
    }
  }
}
