import { ExecutionControls } from '../../library/execution-runtime/execution-controls.js';
import { ExecutionResources } from '../../library/execution-runtime/execution-resources.js';
import { RunQueryCommand } from './run-query-command.js';
import { ExecutionCommand } from './execution-command.js';
import { resolveWorkday } from '../../library/workday/workday-config.js';
import { stateRoot } from '../../library/workspace/state.js';
import { InputError } from '../../library/architecture/config.js';
import type { CliValues } from './arguments.js';

/** Adapts workday commands without duplicating runtime orchestration. */
export class WorkdayCommand {
  /** Retains lifecycle or historical inspection arguments and caller cancellation. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly signal: AbortSignal,
  ) {}

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  async run(): Promise<void> {
    const action = this.positionals[1];
    if (['list', 'get'].includes(action ?? ''))
      return new RunQueryCommand('workday', this.positionals, this.values, this.signal).run();
    if (action === 'run')
      throw new InputError(
        'Manifest execution is retired; use task run "<prompt>" or workday start',
      );
    if (['start', 'pause', 'resume', 'stop', 'status'].includes(action ?? ''))
      return this.control(action!);
    if (this.positionals.length !== 3)
      throw new InputError('workday requires action and manifest/identity');
    if (action === 'inspect') return this.inspectWorkday();
    if (action === 'history' || action === 'follow') return this.viewWorkday();
    throw new InputError('Unknown workday action');
  }

  /** Resolves optional package/start or workday/control identities through shared application services. */
  private async control(action: string): Promise<void> {
    if (
      ![2, 3].includes(this.positionals.length) ||
      Object.keys(this.values).some((key) => key !== 'json')
    )
      throw new InputError('Expected workday ' + action + ' [identity] [--json]');
    if (action === 'start')
      return new ExecutionCommand(this.signal, this.positionals[2]).workday(action);
    const result =
      action === 'status'
        ? new ExecutionResources().workday(this.positionals[2])
        : await new ExecutionControls().workday(action, this.positionals[2]);
    console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
  }

  /** Resolves workday authority without creating a workspace or invoking a model. */
  private inspectWorkday(): void {
    const { values, positionals } = this;
    if (
      !values.project ||
      Object.keys(values).some(
        (k) => !['project', 'base', 'bindings', 'json', 'initializer-model'].includes(k),
      )
    )
      throw new InputError('workday inspect requires --project');
    console.log(
      JSON.stringify(
        resolveWorkday(
          positionals[2]!,
          values.project,
          values.base,
          values.bindings,
          {},
          values['initializer-model'],
        ),
        null,
        values.json ? undefined : 2,
      ),
    );
    return;
  }

  /** Reads retained coordination state for status or event following. */
  private async viewWorkday(): Promise<void> {
    const { values, positionals } = this;
    const action = positionals[1];
    if (
      Object.keys(values).some((k) => !['json', 'after'].includes(k)) ||
      (values.after !== undefined &&
        (action !== 'follow' ||
          !/^\d+$/.test(values.after) ||
          !Number.isSafeInteger(Number(values.after))))
    )
      throw new InputError('Invalid workday viewer arguments');
    const { viewWorkday } = await import('../../library/workday/workday-view.js');
    await viewWorkday(
      stateRoot(),
      positionals[2]!,
      action === 'follow',
      !!values.json,
      Number(values.after ?? 0),
      this.signal,
    );
    return;
  }
}
