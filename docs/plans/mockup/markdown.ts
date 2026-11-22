import highlight from 'highlight.js/lib/core';
import markdown from 'highlight.js/lib/languages/markdown';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
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
        ? `<a class="arc-link" href="${escape(href)}" title="${escape(title)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
    },
    image({ text, href, title }) {
      const label = escape(text);
      return safeLink(href)
        ? `<a class="arc-link" data-md-image href="${escape(href)}" title="${escape(title)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
    },
  },
});

const serializer = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  hr: '---',
}).use(gfm);

serializer.addRule('imageLink', {
  filter: (node) => node.nodeName === 'A' && node.hasAttribute('data-md-image'),
  replacement: (label, node) => {
    const title = node.getAttribute('title');
    const suffix = title ? ' ' + JSON.stringify(title) : '';
    return `![${label}](<${node.getAttribute('href') ?? ''}>${suffix})`;
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
  const { body } = splitMarkdown(source);
  const html = parser.parse(body, { async: false });
  if (editing) return editor(html);
  return `<article class="arc-markdown arc-md-view">${html}</article>`;
}

export function highlightMarkdownCode(parent: HTMLElement) {
  for (const block of parent.querySelectorAll<HTMLElement>('.arc-md-view pre code')) {
    const language = [...block.classList].find((name) => name.startsWith('language-'))?.slice(9);
    if (language && highlight.getLanguage(language)) {
      block.innerHTML = highlight.highlight(block.textContent ?? '', { language }).value;
    }
  }
}

type EditorAction = [label: string, command: string, value?: string];
const tools: EditorAction[] = [
  ['Paragraph', 'formatBlock', 'p'],
  ['Heading', 'formatBlock', 'h2'],
  ['Bold', 'bold'],
  ['Italic', 'italic'],
  ['Bullets', 'insertUnorderedList'],
  ['Numbered list', 'insertOrderedList'],
  ['Quote', 'formatBlock', 'blockquote'],
];

function editor(html: string) {
  const buttons = tools
    .map(
      ([label, command, value]) =>
        `<button type="button" class="arc-button" data-md-command="${command}"
      ${value ? `data-md-value="${value}"` : ''}>${label}</button>`,
    )
    .join('');
  return `<div class="arc-md-edit">
    <div class="arc-md-tools" role="group" aria-label="Markdown formatting">${buttons}</div>
    <div class="arc-markdown arc-md-editor" contenteditable="true" data-md-editor
      role="textbox" aria-label="Markdown content" aria-multiline="true">${html}</div>
  </div>`;
}

export function formatMarkdown(trigger: HTMLButtonElement) {
  const editor = trigger.closest('.arc-md-edit')?.querySelector<HTMLElement>('[data-md-editor]');
  const command = trigger.dataset.mdCommand;
  if (!editor || !command) return;
  editor.focus({ preventScroll: true });
  document.execCommand(command, false, trigger.dataset.mdValue);
}

export function pasteMarkdown(event: ClipboardEvent) {
  if (!(event.target instanceof Element) || !event.target.closest('[data-md-editor]')) return;
  event.preventDefault();
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '');
}

export function editedMarkdown(source: string, editor: HTMLElement) {
  const { frontmatter, body } = splitMarkdown(source);
  const rendered = document.createElement('template');
  rendered.innerHTML = parser.parse(body, { async: false });
  if (editor.innerHTML === rendered.innerHTML) return source;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const initial = body.match(/^(?:[ \t]*\r?\n)*/)?.[0] ?? '';
  const final = body.match(/(?:\r?\n)+$/)?.[0] ?? '';
  const markdown = serializer.turndown(editor).replace(/\r?\n/g, newline);
  return frontmatter + initial + markdown + final;
}
