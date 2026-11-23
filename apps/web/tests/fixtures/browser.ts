import { createElement as h } from 'react';
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
  state = { ...state, status, command, metrics: [['Elapsed', '2m 31s']] };
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
await mountWeb(root, binding, h('div', { style: { minBlockSize: '200vh' } }));
