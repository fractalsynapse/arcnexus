import type { Client } from 'pg';
import { z } from 'zod';
import { modelRequest } from '../../../foundation/src/model-request.js';
import { readHostEvidence, type EvidenceRoots } from './host-evidence.js';
import { loadPlanEvents } from './plan-events.js';

const attribution = z.object({
  request: z.string(),
  component: z.string().optional(),
  activity: z.string().optional(),
});
const startEvent = z.object({ nativeStarted: attribution });
export const planContextSchema = attribution
  .omit({ request: true })
  .extend({
    timestamp: z.string().nullable(),
    request: modelRequest,
  })
  .nullable();

/** Resolve the selected Plan's first activation through its retained artifact receipt. */
export async function readPlanContext(
  database: Client,
  remote: string,
  execution: string,
  roots: EvidenceRoots,
) {
  const { events } = await loadPlanEvents(database, remote, execution);
  for (const frame of events) {
    if (frame.taskID !== execution) continue;
    const start = startEvent.safeParse(frame.observation);
    if (!start.success) continue;
    const { component, activity, request } = start.data.nativeStarted;
    if (
      !events.some(
        ({ run, observation }) =>
          run === frame.run && (observation as { artifact?: unknown } | null)?.artifact === request,
      )
    )
      throw new Error('Startup context artifact is not retained in this execution');
    const [captured] = await readHostEvidence(roots, [request]);
    return {
      timestamp: frame.timestamp,
      component,
      activity,
      request: modelRequest.parse(captured),
    };
  }
  return null;
}
