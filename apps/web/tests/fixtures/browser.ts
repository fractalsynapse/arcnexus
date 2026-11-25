import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { DiffView } from '../../../../packages/ui/src/index.js';
import type {
  CommandBinding,
  CommandRequest,
  CommandState,
} from '../../../../packages/ui/src/index.js';
import { mountWeb } from '../../src/composition.js';

interface Fixture {
  requests: CommandRequest[];
  wait: () => void;
  fail: () => void;
  toggleDisplay?: () => Promise<void>;
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
};

const root = document.getElementById('app');
if (!root) throw new Error('Fixture root is missing');
const context = await mountWeb(root, binding, {
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
});

let remove: (() => Promise<void>) | undefined;
window.frameFixture.toggleDisplay = async () => {
  if (remove) {
    await remove();
    remove = undefined;
    return;
  }
  const contribution = await context.use({
    inject: ['ui'],
    /** Attach a display after the frame has mounted to verify plugin lifecycle. */
    apply(context: Context) {
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
