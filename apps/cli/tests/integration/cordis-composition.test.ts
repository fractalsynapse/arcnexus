import assert from 'node:assert/strict';
import test from 'node:test';
import { Context } from 'cordis';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

declare module 'cordis' {
  interface Context {
    compositionProbe: string;
  }
}

test('a compiled app composes and disposes a Cordis service', async () => {
  const root = new Context();
  const service = await root.use((context) => {
    context.provide('compositionProbe', 'mounted');
  });
  await root.inject(['compositionProbe'], (context) => {
    assert.equal(context.compositionProbe, 'mounted');
  });
  await service.dispose();
  assert.equal(root.compositionProbe, undefined);
});
