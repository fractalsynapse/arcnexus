import { DeliveryCommand } from './delivery-command.js';
import { ArchitectureResourceCommand } from './architecture-resource-command.js';
import { InspectionCommand } from './inspection-command.js';
import { PortfolioCommand } from './portfolio-command.js';
import { ConfigCommand } from './config-command.js';
import { AssignmentCommand } from './assignment-command.js';
import { ExperimentCommand } from './experiment-command.js';
import { WorkdayCommand } from './workday-command.js';
import { TestCommand } from './test-command.js';
import { TaskCommand } from './task-command.js';
import { argumentsForCommand, help, type CliValues } from './arguments.js';
import { InputError } from '../../library/architecture/config.js';
import { WorkspaceQueryCommand } from './workspace-query-command.js';

const retiredWorkspaceCommands: Record<string, string> = {
  status: 'workspace get <id>',
  follow: 'workspace get <id> --follow',
  prepare: 'workspace prepare <package>',
  cleanup: 'workspace cleanup <package> [--workspace <id>]',
};

/** Wires command adapters, cancellation, execution locking and public exit codes. */
class CliApplication {
  private values: CliValues = {};

  private positionals: string[] = [];

  private command = '';

  private testWatchdog?: NodeJS.Timeout;

  private readonly controller = new AbortController();

  private cancelled = false;

  private tags: string[] = [];

  private readonly cancel = () => {
    this.cancelled = true;
    this.controller.abort(new Error('Cancelled'));
  };

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  async run(): Promise<void> {
    process.on('SIGINT', this.cancel);
    process.on('SIGTERM', this.cancel);
    try {
      const { values, positionals } = argumentsForCommand();
      const { tag, ...sharedValues } = values;
      this.values = sharedValues;
      this.tags = tag ?? [];
      this.positionals = positionals;
      this.command = positionals[0] ?? '';
      if (values.help) {
        console.log(help);
        return;
      }
      if (values.version) {
        console.log('0.1.0');
        return;
      }
      await this.dispatch();
    } catch (error) {
      this.failure(error);
    } finally {
      this.close();
    }
  }

  /** Routes a validated command to its adapter and preserves shared cancellation. */
  private async dispatch(): Promise<void> {
    if (
      ['standard', 'component', 'workspace', 'platform', 'package', 'config', 'delivery'].includes(
        this.command!,
      )
    )
      return this.resources();
    switch (this.command) {
      case 'run':
        throw new InputError('Component execution is retired; use task run "<prompt>"');
      case 'test':
        this.validateExecution();
        this.startTestWatchdog();
        return new TestCommand(
          this.positionals,
          this.values,
          this.tags,
          this.controller.signal,
        ).run();
      case 'task':
        return new TaskCommand(this.positionals, this.values, this.controller.signal).run();
      case 'workday':
        return new WorkdayCommand(this.positionals, this.values, this.controller.signal).run();
      case 'experiment':
        return new ExperimentCommand(this.positionals, this.values, this.controller.signal).run();
      case 'guidance':
        throw new InputError('Guidance validation is included in validate --project <repository>');
    }
    return this.inspectionCommand();
  }

  /** Routes application resource commands separately from engineering and qualification lifecycles. */
  private async resources(): Promise<void> {
    if (this.command === 'delivery')
      return new DeliveryCommand(this.positionals, this.values, this.controller.signal).run();
    if (['component', 'standard'].includes(this.command!))
      return new ArchitectureResourceCommand(this.positionals, this.values).run();
    if (this.command === 'config') return new ConfigCommand(this.positionals, this.values).run();
    if (this.command === 'workspace')
      return new WorkspaceQueryCommand(this.positionals, this.values, this.controller.signal).run();
    return new PortfolioCommand(this.positionals, this.values, this.controller.signal).run();
  }

  /** Validates architecture or projects captured assignment context without engineering execution. */
  private async inspectionCommand(): Promise<void> {
    if (this.command === 'inspect' && this.values.project === undefined)
      return new InspectionCommand(this.positionals, this.values).run();
    this.validateCommand();
    const assignment = new AssignmentCommand(this.positionals, this.values);
    if (this.command === 'validate') return assignment.catalog();
    const resolved = assignment.resolve();
    console.log(
      this.values.json
        ? JSON.stringify(resolved)
        : `Assignment ${resolved.digest}\n${JSON.stringify(resolved, null, 2)}`,
    );
  }

  /** Bounds only caller-requested test qualification; agent and workspace execution have no deadline. */
  private startTestWatchdog(): void {
    const seconds = this.values['timeout-seconds'];
    if (seconds !== undefined)
      this.testWatchdog = setTimeout(
        () =>
          this.controller.abort(
            Object.assign(new Error('Operation timed out'), { name: 'TimeoutError' }),
          ),
        Number(seconds) * 1000,
      );
  }

  /** Rejects unsupported command and flag combinations before dispatch. */
  private validateCommand(): void {
    const { values, positionals, command } = this;
    const replacement = retiredWorkspaceCommands[command];
    if (replacement) throw new InputError(`${command} is retired; use ${replacement}`);
    if (!['validate', 'inspect'].includes(command ?? '')) throw new InputError(help);
    if (command === 'inspect' && values.activity !== undefined)
      throw new InputError('--activity requires package-aware inspection without --project');
    if (values['max-attempts'] !== undefined)
      throw new InputError('Execution attempt budgets are retired');
    if (
      command === 'inspect' &&
      (!values.project ||
        positionals.length !== (values.assignment ? 2 : 3) ||
        (!values.assignment && !positionals[2]?.trim()))
    )
      throw new InputError('inspect requires component, objective and --project');
    this.validateExecution();
  }

  /** Checks execution arguments before workspace preparation or inference. */
  private validateExecution(): void {
    const { values } = this;
    if (values.issue && !/^[1-9]\d*$/.test(values.issue))
      throw new InputError('Invalid issue number');
    if (values['timeout-seconds'] !== undefined && !['inspect', 'test'].includes(this.command))
      throw new InputError('Execution deadlines are retired; test watchdogs belong to test run');
    const seconds =
      values['timeout-seconds'] === undefined ? undefined : Number(values['timeout-seconds']);
    if (seconds === undefined) return;
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 2_147_483)
      throw new InputError('Invalid timeout');
  }

  /** Translates a thrown error into public output and the appropriate process exit code. */
  private failure(error: unknown): void {
    process.exitCode = this.cancelled ? 130 : error instanceof InputError ? 2 : 1;
    console.error(String(error));
  }

  /** Releases resources owned by this instance. */
  private close(): void {
    clearTimeout(this.testWatchdog);
    process.off('SIGINT', this.cancel);
    process.off('SIGTERM', this.cancel);
  }
}

await new CliApplication().run();
