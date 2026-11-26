import { Subscriptions } from '../../../../packages/ui/src/index.js';
import type { Context } from 'cordis';
import {
  workflowReceipt,
  type CurrentWorkflow,
} from '../../../../packages/commands/src/browser.js';
import type { WorkflowRequest } from '../../../../packages/commands/src/request.js';
import type { GuideDraft } from '../../../../packages/planner/src/guide-draft.js';
import type {
  CommandBinding,
  CommandRequest,
  CommandState,
} from '../../../../packages/ui/src/index.js';
import { dockState, followCommands, unavailable } from './command-stream.js';
import { GatewayFailure } from './gateway-client.js';
import type { BrowserPlatform } from './browser-platform.js';

type Connection = {
  base: string;
  id: string;
  abort: AbortController;
  updates: number;
};
function launch({ operation, instruction, recommendObjectives }: CommandRequest): WorkflowRequest {
  const input = instruction.trim() ? instruction : undefined;
  switch (operation) {
    case 'plan':
      return recommendObjectives
        ? { command: 'task_plan', mode: 'recommend-objectives', focus: input }
        : { command: 'task_plan', objective: input };
    case 'architect':
      return { command: 'architecture_update', feedback: input };
    case 'run':
      return { command: 'task_run', goal: input };
    case 'steer':
      throw new Error('This provider does not accept live steering.');
  }
}

/** Keep the web dock bound to the selected project's durable command receipt. */
class PlatformCommands implements CommandBinding {
  private readonly subscriptions = new Subscriptions();
  private snapshot: CommandState = unavailable;
  private current?: CurrentWorkflow;
  private connection?: Connection;
  private submission?: { id: string; fingerprint: string };
  private sequence = 0;

  /** Bind commands to the same active project and client as the browser displays. */
  constructor(private readonly platform: BrowserPlatform) {}

  /** Observe the active browser scope until the Cordis plugin is disposed. */
  mount() {
    const unsubscribe = this.platform.session.subscribe(this.connect);
    this.connect();
    return () => {
      unsubscribe();
      this.connection?.abort.abort();
    };
  }

  /** Allow the reusable dock and header to consume one live state. */
  getSnapshot = () => this.snapshot;

  /** Notify consumers only through the selected scope's binding. */
  subscribe = this.subscriptions.subscribe;

  /** Rediscover current permissions and any held approval after an interruption. */
  reconnect = () => this.connect(true);

  /** Send the selected dock instruction using the Commands owner's request variants. */
  submit = (input: CommandRequest) => this.submitWorkflow(launch(input));

  /** Submit the operator's exact revision-bound guide draft through the shared command receipt. */
  saveGuide = (draft: GuideDraft) => this.submitWorkflow({ command: 'task_plan', draft });

  /** Start one refinement round, matching the foreground default. */
  refine = () => this.submitWorkflow({ command: 'refine', rounds: '1' });

  /** Submit only the exact gate that was rendered in the current receipt. */
  async answer(key: string, answer: string) {
    const receipt = this.current?.receipt;
    if (!receipt?.gate || this.snapshot.gate?.key !== key)
      throw new Error('This question is no longer open.');
    await this.mutate('/' + receipt.id + '/answer', { gate: receipt.gate.id, answer });
  }

  /** Cancel the same receipt the dock rendered. */
  async cancel() {
    const receipt = this.current?.receipt;
    if (receipt && this.snapshot.canCancel) await this.mutate('/' + receipt.id + '/cancel');
  }

  /** Keep the submission UUID stable if the result was lost and the user retries. */
  private async submitWorkflow(request: WorkflowRequest) {
    if (!this.snapshot.supported.length)
      throw new Error('Commands are unavailable for this project.');
    const fingerprint = JSON.stringify(request);
    if (this.submission?.fingerprint !== fingerprint)
      this.submission = { id: crypto.randomUUID(), fingerprint };
    const pending = this.submission;
    await this.mutate('', { id: pending.id, request });
    if (this.submission === pending) this.submission = undefined;
  }

  /** Close the previous project's subscription before opening the new scope. */
  private connect = (retry = false) => {
    const { project } = this.platform.session.getSnapshot();
    const base = project && '/projects/' + encodeURIComponent(project.id) + '/commands';
    const prior = this.connection;
    const same = Boolean(prior && prior.base === base);
    if (same && !retry) return;
    prior?.abort.abort();
    this.connection = undefined;
    if (!same) {
      this.current = undefined;
      this.submission = undefined;
    }
    if (!base) return this.publish(unavailable);
    const id = same && prior ? prior.id : String(++this.sequence);
    const scope = { base, id, abort: new AbortController(), updates: 0 };
    this.connection = scope;
    this.publish(this.current ? dockState(this.current, id) : { ...unavailable, scope: id });
    this.listen(scope);
  };

  /** Apply only receipt snapshots belonging to the current stream. */
  private listen(scope: Connection) {
    const disconnected = () => {
      if (this.connection !== scope || scope.abort.signal.aborted) return;
      this.publish({ ...this.snapshot, canReconnect: true });
    };
    void followCommands(this.platform.gateway, scope.base, scope.abort.signal, (value) => {
      if (this.connection !== scope) return;
      scope.updates += 1;
      this.current = value;
      this.publish(dockState(value, scope.id));
    }).then(disconnected, disconnected);
  }

  /** Post to the captured scope and keep a newer streamed receipt if it already arrived. */
  private async mutate(path: string, input?: object) {
    const scope = this.connection;
    if (!scope) throw new Error('Select an active project.');
    const updates = scope.updates;
    const response = await this.post(scope, path, input);
    if (this.connection !== scope || !this.current) return;
    if (scope.updates !== updates && this.current.receipt?.id === response.id) return;
    this.current = { ...this.current, receipt: response };
    this.publish({
      ...dockState(this.current, scope.id),
      canReconnect: this.snapshot.canReconnect,
    });
  }

  /** Recheck availability and retained questions after a refused operation. */
  private async post(scope: Connection, path: string, input?: object) {
    try {
      return workflowReceipt.parse(
        await this.platform.gateway.read(scope.base + path, {
          method: 'POST',
          body: input && JSON.stringify(input),
        }),
      );
    } catch (error) {
      if (
        this.connection === scope &&
        error instanceof GatewayFailure &&
        [403, 409].includes(error.status)
      )
        this.reconnect();
      throw error;
    }
  }

  /** Publish one immutable state for all mounted consumers. */
  private publish(snapshot: CommandState) {
    this.snapshot = snapshot;
    this.subscriptions.publish();
  }
}

export const platformCommandsPlugin = {
  inject: ['webPlatform'],
  /** Publish the REST-backed command binding only in the operator platform composition. */
  apply(context: Context) {
    const commands = new PlatformCommands(context.webPlatform);
    context.provide('webCommands', commands);
    context.effect(() => commands.mount());
  },
};
