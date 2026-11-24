import type { Context } from 'cordis';
import type { Capacity } from '../../../packages/capacity/src/index.js';
import {
  enrollmentSchema,
  providerDecisionSchema,
  providerIdentitySchema,
} from '../../../packages/capacity/src/index.js';

type AuthenticateOperator = (request: Request) => string | undefined | Promise<string | undefined>;

const privateHeaders = { 'Cache-Control': 'no-store' };

function error(status: number) {
  return Response.json({ error: 'Capacity request unavailable' }, { status });
}

async function enrollment(capacity: Capacity, request: Request) {
  const { code, ...info } = enrollmentSchema.parse(await request.json());
  return Response.json(await capacity.claim(code, info), { status: 201, headers: privateHeaders });
}

function credential(request: Request, id: string) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const identity = providerIdentitySchema.safeParse({ id, token });
  return identity.success ? identity.data.token : undefined;
}

async function providerStatus(capacity: Capacity, request: Request, id: string) {
  const token = credential(request, id);
  const provider = token && (await capacity.authenticate(id, token));
  return provider ? Response.json(provider, { headers: privateHeaders }) : error(401);
}

async function providerConnection(capacity: Capacity, request: Request, id: string) {
  const token = credential(request, id);
  const presence = token && (await capacity.connect(id, token));
  if (!presence) return error(403);
  const signal = AbortSignal.any([presence.signal, request.signal]);
  const ready = new TextEncoder().encode('event: ready\ndata: {}\n\n');
  let cancelled = false;
  const body = new ReadableStream({
    start(stream) {
      const close = () => {
        if (!cancelled) stream.close();
        presence.close();
      };
      if (signal.aborted) return close();
      stream.enqueue(ready);
      signal.addEventListener('abort', close, { once: true });
    },
    cancel() {
      cancelled = true;
      presence.close();
    },
  });
  return new Response(body, {
    headers: { ...privateHeaders, 'Content-Type': 'text/event-stream' },
  });
}

async function operate(capacity: Capacity, operator: string, request: Request, path: string) {
  if (path === '/capacity-providers' && request.method === 'GET')
    return Response.json(await capacity.list(operator));
  if (path === '/capacity-providers/codes' && request.method === 'POST')
    return Response.json(
      { code: await capacity.issue(operator) },
      { status: 201, headers: privateHeaders },
    );
  const decision = /^\/capacity-providers\/([^/]+)$/.exec(path);
  if (decision?.[1] && request.method === 'PATCH') {
    const { state } = providerDecisionSchema.parse(await request.json());
    return Response.json(await capacity.decide(operator, decision[1], state));
  }
  return error(404);
}

/** Mount enrollment and exact operator actions in an isolated platform composition. */
export function capacityHttp(capacity: Capacity, authenticate: AuthenticateOperator) {
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/capacity-providers/enrollment' && request.method === 'POST')
        return await enrollment(capacity, request);
      const status = /^\/capacity-providers\/([^/]+)\/status$/.exec(path);
      if (status?.[1] && request.method === 'GET')
        return await providerStatus(capacity, request, status[1]);
      const connection = /^\/capacity-providers\/([^/]+)\/connection$/.exec(path);
      if (connection?.[1] && request.method === 'GET')
        return await providerConnection(capacity, request, connection[1]);
      const operator = await authenticate(request);
      if (!operator) return error(401);
      return await operate(capacity, operator, request, path);
    } catch {
      return error(400);
    }
  };
}

declare module 'cordis' {
  interface Context {
    capacityApi: ReturnType<typeof capacityHttp>;
  }
}

export function capacityApiPlugin(authenticate: AuthenticateOperator) {
  return {
    inject: ['capacity'],
    /** Supply authenticated provider management alongside project resources. */
    apply(context: Context) {
      context.provide('capacityApi', capacityHttp(context.capacity, authenticate));
    },
  };
}
