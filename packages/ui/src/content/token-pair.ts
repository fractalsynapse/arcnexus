import { createElement as h, type ReactNode } from 'react';
import { DialogButton } from '../controls/dialog-button.js';
import { Tooltip } from '../controls/tooltip.js';

export interface TokenUsage {
  input?: number | null;
  output?: number | null;
}

export interface TokenDetails {
  title: string;
  content: ReactNode;
}

export const tokenPairHint = 'Input / output tokens';

const fraction = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function thousands(value?: number | null) {
  return value == null ? '—' : fraction.format(value / 1000) + 'K';
}

export function formatTokenPair({ input, output }: TokenUsage) {
  return thousands(input) + ' / ' + thousands(output);
}

/** Show compact counts with their order available on hover and keyboard focus. */
export function TokenPair({ details, ...usage }: TokenUsage & { details?: TokenDetails }) {
  const value = formatTokenPair(usage);
  if (details != null)
    return h(DialogButton, {
      title: details.title,
      label: value,
      hint: tokenPairHint,
      className: 'arc-token-details',
      children: details.content,
    });
  return h(
    Tooltip,
    { label: tokenPairHint },
    h('span', { tabIndex: 0, 'aria-label': tokenPairHint + ' ' + value }, value),
  );
}
