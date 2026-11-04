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
import { captureChanges } from '../../library/change-inspection/changes.js';
import { saveMarkdown } from '../../library/report/report.js';
import { observe } from '../../library/report/timeline.js';
import { lock, save, stateRoot, type RecordData } from '../../library/workspace/state.js';
import { WorkspaceCommand } from './workspace-command.js';
import { WorkspaceQueryCommand } from './workspace-query-command.js';

function finalize(root: string, record: RecordData): void {
  record.outcome ??= record.status;
  record.finishedAt = new Date().toISOString();
  record.elapsedMs = Date.now() - Date.parse(record.startedAt);
  try {
    captureChanges(root, record);
  } catch (error) {
    record.evidenceError = String(error);
    if (process.exitCode === undefined) {
      process.exitCode = 1;
      record.status = 'failed';
    }
  }
  observe(root, record, 'run.finalized', { status: record.status, outcome: record.outcome });
  save(root, record);
  saveMarkdown(root, record);
  console.log(JSON.stringify(record));
}

/** Wires command adapters, cancellation, execution locking and public exit codes. */
class CliApplication {
  private values: CliValues = {};

  private positionals: string[] = [];

  private command = '';

  private record?: RecordData;

  private root?: string;

  private unlock?: () => void;

  private testWatchdog?: NodeJS.Timeout;

  private readonly controller = new AbortController();

  private cancelled = false;

  private tags: string[] = [];

  private readonly cancel = () => {
    this.cancelled = true;
    if (this.record) this.record.cancellation = 'requested';
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
    return this.assignmentCommand();
  }

  /** Routes application resource commands separately from engineering and qualification lifecycles. */
  private async resources(): Promise<void> {
    if (this.command === 'delivery')
      return new DeliveryCommand(this.positionals, this.values).run();
    if (['component', 'standard'].includes(this.command!))
      return new ArchitectureResourceCommand(this.positionals, this.values).run();
    if (this.command === 'config') return new ConfigCommand(this.positionals, this.values).run();
    if (this.command === 'workspace')
      return new WorkspaceQueryCommand(this.positionals, this.values, this.controller.signal).run();
    return new PortfolioCommand(this.positionals, this.values, this.controller.signal).run();
  }

  /** Resolves an assignment and dispatches it through the shared steward workflow. */
  private async assignmentCommand(): Promise<void> {
    if (this.command === 'inspect' && this.values.project === undefined)
      return new InspectionCommand(this.positionals, this.values).run();
    this.validateCommand();
    const assignment = new AssignmentCommand(this.positionals, this.values, this.command);
    if (this.command === 'validate') return assignment.catalog();
    const input = assignment.resolve();
    if (this.command === 'inspect') {
      console.log(
        this.values.json
          ? JSON.stringify(input.resolved)
          : `Assignment ${input.resolved!.digest}\n${JSON.stringify(input.resolved, null, 2)}`,
      );
      return;
    }
    const root = this.acquire();
    if (this.command === 'cleanup')
      new WorkspaceCommand(this.values).cleanup(root, this.positionals[1]!);
    else await this.execute(input, root);
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

  /** Takes the execution lock before a command can mutate managed workspace state. */
  private acquire(): string {
    this.root = stateRoot();
    this.unlock = lock(this.root);
    return this.root;
  }

  /** Rejects unsupported command and flag combinations before dispatch. */
  private validateCommand(): void {
    const { values, positionals, command } = this;
    if (command === 'status' || command === 'follow')
      throw new InputError(
        `${command} is retired; use workspace get <id>${command === 'follow' ? ' --follow' : ''}`,
      );
    if (!['prepare', 'cleanup', 'validate', 'inspect'].includes(command ?? ''))
      throw new InputError(help);
    if (command === 'inspect' && values.activity !== undefined)
      throw new InputError('--activity requires package-aware inspection without --project');
    if (values['max-attempts'] !== undefined)
      throw new InputError('Execution attempt budgets are retired');
    if (command === 'prepare' && (!values.project || positionals.length !== 1))
      throw new InputError('prepare requires --project');
    if (
      command === 'inspect' &&
      (!values.project ||
        positionals.length !== (values.assignment ? 2 : 3) ||
        (!values.assignment && !positionals[2]?.trim()))
    )
      throw new InputError('inspect requires component, objective and --project');
    if (command === 'cleanup' && positionals.length !== 2)
      throw new InputError('cleanup requires workspace ID');
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

  /** Runs the requested action through the configured execution boundary. */
  private async execute(
    input: ReturnType<AssignmentCommand['resolve']>,
    root: string,
  ): Promise<void> {
    const { values } = this;
    const { resolved } = input;
    const workspace = new WorkspaceCommand(values);
    const record = (this.record = workspace.create(root, input));
    if (resolved) record.resolvedAssignment = resolved;
    if (['simulation', 'live'].includes(process.env.ARCNEXUS_EXPERIMENT_MODE ?? ''))
      record.evidenceMode = process.env.ARCNEXUS_EXPERIMENT_MODE;
    await workspace.prepare(root, record, this.controller.signal);
  }

  /** Translates a thrown error into public output and the appropriate process exit code. */
  private failure(error: unknown): void {
    if (this.record) {
      this.record.status = this.cancelled
        ? 'cancelled'
        : ['blocked', 'no_changes', 'needs_attention'].includes(this.record.status)
          ? this.record.status
          : 'failed';
      this.record.error = String(error);
    }
    process.exitCode = this.cancelled ? 130 : error instanceof InputError ? 2 : 1;
    console.error(String(error));
  }

  /** Releases resources owned by this instance. */
  private close(): void {
    clearTimeout(this.testWatchdog);
    try {
      if (this.record && this.root) finalize(this.root, this.record);
    } finally {
      this.unlock?.();
      process.off('SIGINT', this.cancel);
      process.off('SIGTERM', this.cancel);
    }
  }
}

await new CliApplication().run();
