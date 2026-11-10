/** Formats one retained diagnostic without changing its original message or adding a stack or cause. */
export function retainedFailureText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return 'Error: ' + message;
}
