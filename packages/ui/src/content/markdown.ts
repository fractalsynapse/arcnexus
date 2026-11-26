import highlight from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';

for (const [language, definition] of Object.entries({ markdown, json, typescript, yaml }))
  highlight.registerLanguage(language, definition);

function escape(value: string | null | undefined) {
  return (value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}

function safeLink(url: string) {
  const protocol = URL.parse(url, 'https://arcnexus.invalid')?.protocol;
  return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
}

function link(href: string, label: string, title?: string | null) {
  return safeLink(href)
    ? '<a class="arc-link" target="_blank" rel="noopener noreferrer" href="' +
        escape(href) +
        '" title="' +
        escape(title) +
        '">' +
        label +
        '</a>'
    : label;
}

const parser = new Marked({
  renderer: {
    html: ({ text }) => escape(text),
    link({ href, tokens, title }) {
      return link(href, this.parser.parseInline(tokens), title);
    },
    image({ href, text, title }) {
      return link(href, escape(text), title);
    },
    code({ text, lang }) {
      return renderCodeBlock(text, lang?.trim().split(/\s+/)[0] ?? '');
    },
  },
});

/** Render Markdown without allowing embedded HTML or unsafe link schemes. */
export function renderMarkdown(body: string) {
  return parser.parse(body, { async: false });
}

/** Highlight a declared language with escaped token markup. */
export function highlightCode(text: string, language: string) {
  return language && highlight.getLanguage(language)
    ? highlight.highlight(text, { language }).value
    : undefined;
}

/** Render a syntax-highlighted source block with the same escaping as Markdown. */
export function renderCodeBlock(text: string, language: string) {
  return (
    '<pre><code class="language-' +
    escape(language) +
    '">' +
    (highlightCode(text, language) ?? escape(text)) +
    '</code></pre>\n'
  );
}
