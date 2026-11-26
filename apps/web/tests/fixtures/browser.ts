import { createElement as h } from 'react';
import { Context } from 'cordis';
import { DiffView } from '../../../../packages/ui/src/index.js';
import type {
  CommandBinding,
  CommandRequest,
  CommandState,
} from '../../../../packages/ui/src/index.js';
import { mountWeb } from '../../src/composition.js';
import { browserPlatformPlugin } from '../../src/platform/browser-platform.js';

interface Fixture {
  requests: CommandRequest[];
  wait: () => void;
  fail: () => void;
  toggleDisplay?: () => Promise<void>;
  platformIsolation: typeof platformIsolation;
}

declare global {
  interface Window {
    frameFixture: Fixture;
  }
}

const requests: CommandRequest[] = [];
const listeners = new Set<() => void>();
let state: CommandState = { status: 'Idle', supported: ['plan', 'architect', 'run'] };
let rejectRequest: ((error: Error) => void) | undefined;

/** Publish controlled observations for the application binding's subscribers. */
function observe(status: CommandState['status'], command = state.command) {
  state = {
    ...state,
    status,
    command,
    metrics: [
      ['Elapsed', '2m 31s'],
      ['Reported tokens', { input: 853600, output: 15200 }],
    ],
  };
  for (const listener of listeners) listener();
}

const binding: CommandBinding = {
  getSnapshot: () => state,
  subscribe: (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  submit: (request) => {
    requests.push(request);
    observe('Active', request.operation === 'architect' ? 'Architect' : 'Plan');
    return new Promise((_resolve, reject) => {
      rejectRequest = reject;
    });
  },
};

window.frameFixture = {
  requests,
  wait: () => observe('Waiting'),
  fail: () => {
    observe('Failed');
    rejectRequest?.(new Error('The controlled command failed.'));
  },
  platformIsolation,
};

async function platformIsolation() {
  const [left, right] = await Promise.all([isolatedPlatform('left'), isolatedPlatform('right')]);
  const first = left.gateway.share('/projects', 'projects');
  const second = right.gateway.share('/projects', 'projects');
  const received = await Promise.all([first.value, second.value]);
  first.release();
  second.release();
  left.session.select(undefined);
  left.timelines.set('/events', { frames: [], cursor: 'left' });
  return {
    received,
    rightProject: right.session.getSnapshot().project?.id,
    rightCursor: right.timelines.get('/events')?.cursor,
  };
}

async function isolatedPlatform(id: string) {
  const scope = new Context();
  await scope.use(
    browserPlatformPlugin({
      project: { id, remote: 'https://github.com/example/' + id, revision: 'fixture' },
      transport: async () => Response.json(id),
    }),
  );
  return scope.webPlatform;
}

const root = document.getElementById('app');
if (!root) throw new Error('Fixture root is missing');
const displayFixture = {
  inject: ['ui'],
  /** Contribute fixture displays through the same registry as workspace features. */
  apply(context: Context) {
    context.effect(() =>
      context.ui.registerDisplay('/plan/', {
        id: 'metrics',
        label: 'Planning data',
        content: h('div', { style: { minBlockSize: '200vh' } }),
      }),
    );
    context.effect(() =>
      context.ui.registerDisplay('/plan/', {
        id: 'outcome',
        label: 'Planner outcome',
        defaultRegion: 1,
        content: 'Fixture outcome',
      }),
    );
    context.effect(() =>
      context.ui.registerDisplay('/release/', {
        id: 'changes',
        label: 'Changes',
        content: h(DiffView, {
          files: [
            { path: 'src/first.ts', before: 'old first', after: 'new first' },
            { path: 'src/second.ts', before: 'old second', after: 'new second' },
          ],
        }),
      }),
    );
  },
};
const context = await mountWeb(root, { commands: binding, feature: displayFixture });

let remove: (() => Promise<void>) | undefined;
window.frameFixture.toggleDisplay = async () => {
  if (remove) {
    await remove();
    remove = undefined;
    return;
  }
  const contribution = await context.use({
    inject: ['ui'],
    /** Attach workspace content and a display after the frame has mounted. */
    apply(context: Context) {
      context.effect(() =>
        context.ui.registerWorkspaceFeature('/plan/', {
          content: h('p', null, 'Fixture workspace content'),
        }),
      );
      context.effect(() =>
        context.ui.registerDisplay('/plan/', {
          id: 'evidence',
          label: 'Supporting evidence',
          content: 'Fixture evidence',
        }),
      );
    },
  });
  remove = async () => {
    await contribution.dispose();
  };
};
