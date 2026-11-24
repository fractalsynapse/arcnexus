import { z } from 'zod';
import type { JournalEvent } from '../journal-types.js';

export const toolCountsSchema = z.strictObject({
  entries: z.array(z.strictObject({ name: z.string(), calls: z.number().int() })),
});
type Native = {
  nativeEvent?: {
    activation: string;
    event?: { item?: { type?: string; tool?: string; id?: string } };
  };
};

/** Count correlated MCP tool calls once across their reported updates. */
export function frequencies(events: JournalEvent[]) {
  const calls = new Set<string>();
  const counts = new Map<string, number>();
  for (const frame of events) {
    const native = (frame.observation as Native | null)?.nativeEvent;
    const item = native?.event?.item;
    if (item?.type !== 'mcp_tool_call' || !item.tool) continue;
    const identity = JSON.stringify([native?.activation, item.id ?? frame.sequence]);
    if (calls.has(identity)) continue;
    calls.add(identity);
    counts.set(item.tool, (counts.get(item.tool) ?? 0) + 1);
  }
  return {
    entries: [...counts]
      .map(([name, calls]) => ({ name, calls }))
      .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name)),
  };
}
