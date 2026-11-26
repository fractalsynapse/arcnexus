/** Locate the verbatim file blocks emitted by the model request builder. */
export function capturedDocuments(input: string) {
  return [
    ...input.matchAll(/^Source: ([^\n]+)\n--- BEGIN \1 ---\n([\s\S]*?)^--- END \1 ---$/gm),
  ].map((match) => ({
    path: match[1]!,
    content: match[2]!,
    start: match.index,
    end: match.index + match[0].length,
  }));
}
