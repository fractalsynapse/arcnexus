import { ArchitectureInspection } from '../../library/architecture/inspection.js';
import { InputError } from '../../library/architecture/config.js';
import { Portfolio } from '../../library/portfolio/portfolio.js';
import type { CliValues } from './arguments.js';

/** Adapts registered package inspection to the shared read-only architecture service. */
export class InspectionCommand {
  /** Retains parsed input without starting a host or opening writable persistence. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
  ) {}

  /** Rejects flags this command does not read, so a typo cannot silently change the stance. */
  private checkOptions(): void {
    const allowed = ['json', 'activity', 'milestone'];
    for (const key of Object.keys(this.values))
      if (!allowed.includes(key)) throw new InputError('Unsupported inspection option: ' + key);
  }

  /**
   * Renders the frame a component would be shown for one activity, or the catalog index.
   *
   * Positionals follow the contract `[project] [component] [activity]`: a leading reference that
   * resolves as a registered package names the project, anything else names the component and the
   * project comes from the working directory. The goal is never an argument here — an inspected
   * frame shows placeholders for what only a live assignment can know, so two people can compare
   * what they were shown.
   */
  run(): void {
    if (this.positionals.length > 4)
      throw new InputError('Expected inspect [project] [component] [activity]');
    this.checkOptions();
    const portfolio = new Portfolio();
    try {
      const { project, componentId, activity } = this.targets(portfolio);
      const target = portfolio.packageTarget(project);
      const inspection = new ArchitectureInspection();
      if (!componentId) {
        this.print(inspection.index(target), !!this.values.json);
        return;
      }
      const result = inspection.inspect({
        source: target.source,
        revision: target.base,
        packageId: target.packageId,
        componentId,
        ...(activity ? { activity } : {}),
      });
      this.print(result, !!this.values.json);
    } finally {
      portfolio.close();
    }
  }

  /**
   * Splits positionals into project, component and activity under the contract's optional grammar.
   *
   * A leading reference names a project only when it actually resolves as one; otherwise the working
   * directory supplies the project and the leading word is the component. Without that test the same
   * positional would be ambiguous between the two roles.
   */
  private targets(portfolio: Portfolio): {
    project?: string;
    componentId?: string;
    activity?: string;
  } {
    const [first, second, third] = this.positionals.slice(1);
    // An empty positional is a malformed request, not an absent one: slots are optional, but a shell
    // that passes "" means someone asked for something and gave no name. Accepting it would let the
    // surface silently fall back to a different inspection than the caller requested.
    for (const slot of [first, second, third])
      if (slot !== undefined && !slot.trim())
        throw new InputError('Inspection positionals must name a project, component or activity');
    const named = first !== undefined && this.resolvesAsProject(portfolio, first);
    if (!named && third !== undefined)
      throw new InputError(
        `Inspection resolved no project from '${first}'; pass [component] [activity] or register the package`,
      );
    const slot = named ? second : first;
    const activity = ((named ? third : second) ?? this.values.activity) as string | undefined;
    // The component slot carries the position: `director` and `verifier` are reserved identifiers for
    // the positions that are not tied to one component, and any other name is the component whose
    // steward view is wanted. There is no mode flag, because the slot already says what is being asked.
    return {
      ...(named ? { project: first } : {}),
      componentId: slot,
      ...(activity ? { activity } : {}),
    };
  }

  /** True when a reference names a registered package rather than a component of this project. */
  private resolvesAsProject(portfolio: Portfolio, reference: string): boolean {
    try {
      portfolio.packageTarget(reference);
      return true;
    } catch {
      return false;
    }
  }

  /** Prints readable text by default and the raw structure under `--json`. */
  private print(payload: unknown, json: boolean): void {
    if (json) console.log(JSON.stringify(payload));
    else if (typeof payload === 'string') console.log(payload);
    else console.log((payload as { frame?: string }).frame ?? JSON.stringify(payload, null, 2));
  }
}
