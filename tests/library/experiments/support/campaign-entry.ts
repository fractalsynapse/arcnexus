import { PromptExperimentResolver } from '../../../../dist/library/experiments/experiment-config.js';
import { InputError } from '../../../../dist/library/architecture/config.js';
import { PromptExperimentRunner } from './prompt-campaign.js';

/** Runs deterministic campaign assertions only inside the acceptance-test subprocess. */
async function run(): Promise<void> {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  try {
    const [manifest, bindings, output] = process.argv.slice(2);
    if (!manifest || !bindings || !output) throw new InputError('Missing acceptance inputs');
    const input = new PromptExperimentResolver().resolve(manifest, bindings, 'simulation');
    const result = await new PromptExperimentRunner(controller.signal).run(input, output);
    process.exitCode = result.status === 'passed' ? 0 : result.status === 'cancelled' ? 130 : 1;
    console.log(JSON.stringify({ status: result.status, output }));
  } catch (error) {
    console.error(String(error));
    process.exitCode = controller.signal.aborted ? 130 : 2;
  }
}

await run();
