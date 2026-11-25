/** Separate an optional YAML header without changing either part of the document. */
export function splitMarkdown(source: string) {
  const frontmatter =
    source.match(
      /^(?:\uFEFF)?---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/,
    )?.[0] ?? '';
  const metadata = frontmatter.replace(/^(?:\uFEFF)?---[^\n]*\n|(?:---|\.\.\.)[ \t]*\r?\n?$/g, '');
  return { frontmatter, metadata, body: source.slice(frontmatter.length) };
}
