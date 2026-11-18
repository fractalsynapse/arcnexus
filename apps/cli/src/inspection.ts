import type { Context } from 'cordis';

/** Show the invocation header followed by the complete prompt from the SDK. */
export function renderInspection(result: ReturnType<Context['commands']['inspect']>) {
  return [
    `Placeholders: ${result.placeholders.join(', ')}`,
    'Invocation options:',
    JSON.stringify(result.request.options, null, 2),
    '--- Codex input ---',
    result.request.input,
  ].join('\n');
}
