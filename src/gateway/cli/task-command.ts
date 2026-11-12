import { ExecutionControls } from '../../library/execution-runtime/execution-controls.js';
import { RunQueryCommand } from './run-query-command.js';
import type { CliValues } from './arguments.js';
import { ExecutionCommand } from './execution-command.js';
import { InputError } from '../../library/architecture/config.js';
import type { RunStance } from '../../library/coordination-store/execution-types.js';
import { ProposalStore } from '../../library/task-intake/tasks.js';
import { stateRoot } from '../../library/workspace/state.js';

/** Runs prompt tasks through the project host and reads historical proposals without executing them. */
export class TaskCommand {
  /** Retains task arguments and cancellation without creating execution state. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly signal: AbortSignal,
  ) {}

  /** Rejects retired execution before dispatch and preserves read-only proposal inspection. */
  async run(): Promise<void> {
    const action = this.positionals[1];
    if (['list', 'get', 'follow'].includes(action ?? ''))
      return new RunQueryCommand('task', this.positionals, this.values, this.signal).run();
    if (['pause', 'resume', 'stop', 'answer'].includes(action ?? '')) return this.control(action!);
    if (action === 'run') return this.submit();
    if (action === 'plan' || action === 'legacy-run')
      throw new InputError('Proposal execution is retired; use task run "<prompt>"');
    if (this.positionals.length !== 3 || action !== 'inspect')
      throw new InputError(
        'task run requires exactly one prompt; task inspect requires one historical proposal ID',
      );
    const allowed = ['json'];
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Invalid task options');
    console.log(
      JSON.stringify(
        new ProposalStore(stateRoot()).load(this.positionals[2]!),
        null,
        this.values.json ? undefined : 2,
      ),
    );
  }

  /** Validates prompt arity and submits either a local or explicitly registered package task. */
  private async submit(): Promise<void> {
    if (![3, 4].includes(this.positionals.length))
      throw new InputError('Expected task run [package] "<prompt>"');
    const allowed = ['async', 'json', 'simulate', 'plan', 'component', 'activity'];
    for (const key of Object.keys(this.values))
      if (!allowed.includes(key)) throw new InputError('Invalid task run option: ' + key);
    if (!this.positionals.at(-1)!.trim()) throw new InputError('Task prompt must not be empty');
    const packageReference = this.positionals.length === 4 ? this.positionals[2] : undefined;
    await new ExecutionCommand(this.signal, packageReference).task(
      this.positionals.at(-1)!,
      this.values.async,
      this.values.simulate,
      this.stance(),
    );
  }

  /**
   * Resolves the run's stance from the flags, refusing combinations that would mean two things.
   *
   * `--component` names who works, in place, on the current checkout. `--activity` without a
   * component fans that activity across every component holding it, which is why the host then
   * demands a strictly clean tree and proves no two components own overlapping scopes.
   */
  private stance(): RunStance | undefined {
    const { plan, component, activity } = this.values;
    if (plan && (component || activity))
      throw new InputError('--plan cannot be combined with --component or --activity');
    if (!activity)
      return plan
        ? { kind: 'plan' }
        : component
          ? { kind: 'component', component, fanOut: false }
          : undefined;
    const known = ['research', 'documentation', 'testing', 'implementation', 'review', 'release'];
    if (!known.includes(activity)) throw new InputError('Unknown activity: ' + activity);
    if (component) return { kind: 'component', component, activity, fanOut: false };
    return { kind: 'component', activity, fanOut: true };
  }

  /** Dispatches identity-based controls independently of any current checkout. */
  private async control(action: string): Promise<void> {
    if (this.positionals.length !== (action === 'answer' ? 4 : 3))
      throw new InputError(
        'Expected task ' + action + ' <id>' + (action === 'answer' ? ' "<response>"' : ''),
      );
    if (Object.keys(this.values).some((key) => key !== 'json'))
      throw new InputError('Invalid task control options');
    const result = await new ExecutionControls().task(
      action,
      this.positionals[2]!,
      this.positionals[3],
      undefined,
      this.signal,
    );
    console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
  }
}
