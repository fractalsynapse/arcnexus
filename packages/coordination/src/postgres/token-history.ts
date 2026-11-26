import { z } from 'zod';
import type { JournalEvent } from '../journal-types.js';
import { RunMeasurements } from '../measurements.js';

const tokenSample = z.strictObject({
  sequence: z.string(),
  timestamp: z.string().nullable(),
  input: z.number().nullable(),
  output: z.number().nullable(),
});

export const tokenHistorySchema = z.strictObject({ samples: z.array(tokenSample) });

/** Sample cumulative accounting only when the provider reports usage. */
export function tokenHistory(events: readonly JournalEvent[]) {
  const samples: z.output<typeof tokenSample>[] = [];
  const measurements = new RunMeasurements(({ sequence, timestamp }, usage) => {
    samples.push({
      sequence,
      timestamp,
      input: usage.input_tokens.reported,
      output: usage.output_tokens.reported,
    });
  });
  for (const event of events) measurements.accept(event);
  return { samples };
}
