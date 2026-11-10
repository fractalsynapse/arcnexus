#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

/**
 * Runs the direction corpus through the live probe, reporting usage as each scenario proceeds.
 *
 * This drives `scripts/direction-probe.mjs` as a subprocess — one authored planning chain, no
 * duplicated machinery — and adds what a benchmark needs: wall time per scenario, the harness
 * journal read while the model is still working, and usage totals. Live metrics are printed during
 * each run rather than only after it, because a stalled or looping activation is the thing worth
 * seeing while it happens.
 */
export class DirectionBenchmark {
  /** Resolves the corpus, probe, state root and per-scenario limit from caller arguments. */
  constructor(args) {
    const flags = DirectionBenchmark.flags(args);
    this.corpus = resolve(flags.get('--corpus') ?? 'scripts/direction-corpus.json');
    this.probe = resolve(flags.get('--probe') ?? 'scripts/direction-probe.mjs');
    this.state = resolve(flags.get('--state') ?? join('/tmp', 'arcnexus-benchmark'));
    this.timeout = Number(flags.get('--timeout') ?? 900);
    this.only = flags.get('--scenario');
  }

  /** Runs every selected scenario in order, printing live progress and a final benchmark table. */
  async run() {
    const started = Date.now();
    const scenarios = DirectionBenchmark.scenarios(this.corpus);
    const rows = [];
    for (const scenario of scenarios.filter((item) => !this.only || item.id === this.only)) {
      console.log(`\n=== ${scenario.id} — ${scenario.goal.slice(0, 90)}`);
      rows.push(await this.one(scenario));
    }
    DirectionBenchmark.summary(rows, Date.now() - started);
    process.exitCode = rows.some((row) => row.status !== 'ready' || row.problems.length) ? 1 : 0;
  }

  /** Runs one scenario live, tailing its journal so usage appears while the model is working. */
  async one(scenario) {
    const before = this.journals();
    const clock = Date.now();
    const child = spawn(
      process.execPath,
      [
        this.probe,
        '--mode',
        'live',
        '--corpus',
        this.corpus,
        '--scenario',
        scenario.id,
        '--state',
        this.state,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const output = this.collect(child);
    const watch = setInterval(() => this.report(this.newest(before), Date.now() - clock), 10_000);
    await this.finished(child, output.closed);
    clearInterval(watch);
    return this.result(scenario, output.json(), Date.now() - clock, this.newest(before));
  }

  /** Resolves when the probe exits, or kills it once its time limit has passed. */
  finished(child, closed) {
    return new Promise((done) => {
      const limit = setTimeout(() => {
        console.log('  time limit reached; stopping the activation');
        child.kill('SIGTERM');
        done();
      }, this.timeout * 1_000);
      closed.then(() => {
        clearTimeout(limit);
        done();
      });
    });
  }

  /** Buffers the probe's stdout, which carries its final JSON report, while errors stream through. */
  collect(child) {
    const chunks = [];
    child.stdout.on('data', (part) => chunks.push(part));
    child.stderr.on('data', (part) => process.stderr.write(part));
    return {
      closed: new Promise((done) => child.on('close', done)),
      text: () => Buffer.concat(chunks).toString('utf8'),
      json: () => DirectionBenchmark.json(Buffer.concat(chunks).toString('utf8')),
    };
  }

  /** Prints the metrics read so far: event mix, tool calls and token usage for the live journal. */
  report(journal, elapsed) {
    const usage = DirectionBenchmark.usage(journal);
    console.log(
      `  … ${Math.round(elapsed / 1000)}s events=${usage.events} tools=${usage.calls} ` +
        `in=${usage.input} out=${usage.output} reasoning=${usage.reasoning} notices=${usage.notices.size}`,
    );
  }

  /** Final per-scenario row: status, team, lint problems, timing and full usage totals. */
  result(scenario, report, elapsed, journal) {
    const usage = DirectionBenchmark.usage(journal);
    const row = {
      id: scenario.id,
      status: report.status ?? 'failed',
      owners: (report.selectedOwners ?? []).length,
      questions: report.questions ?? 0,
      problems: report.problems ?? [],
      seconds: Math.round(elapsed / 100) / 10,
      usage,
    };
    console.log(
      `  ${row.status}: owners=${row.owners} questions=${row.questions} ` +
        `events=${usage.events} tools=${usage.calls} in=${usage.input} cached=${usage.cached} ` +
        `out=${usage.output} reasoning=${usage.reasoning} msgs=${usage.messages} in ${row.seconds}s`,
    );
    for (const problem of row.problems) console.log(`    ! ${problem}`);
    return row;
  }

  /** Every harness journal currently under the state root, keyed by path. */
  journals() {
    const runs = join(this.state, 'arcnexus', 'state', 'runs');
    if (!existsSync(runs)) return {};
    const found = {};
    for (const id of readdirSync(runs)) {
      const path = join(runs, id, 'events.jsonl');
      if (existsSync(path)) found[path] = statSync(path).mtimeMs;
    }
    return found;
  }

  /** The most recently written journal that was not already present before the run started. */
  newest(before) {
    const fresh = Object.entries(this.journals())
      .filter(([path, time]) => !before[path] || time > before[path])
      .sort((a, b) => b[1] - a[1]);
    return fresh.length ? fresh[0][0] : undefined;
  }

  /**
   * Totals the harness journal: event mix, tool calls, messages, notices and token usage.
   *
   * Items carry their kind on `item.type` while the envelope says only `item.completed`, so the item
   * is what counts. Error items are collected by message instead of merely totaled: the runtime
   * passes a flag the harness now deprecates, and one notice repeated per activation must never be
   * read as that many failures.
   */
  static usage(journal) {
    const total = {
      events: 0,
      calls: 0,
      messages: 0,
      input: 0,
      cached: 0,
      output: 0,
      reasoning: 0,
      notices: new Set(),
    };
    if (!journal || !existsSync(journal)) return total;
    for (const line of readFileSync(journal, 'utf8').split('\n').filter(Boolean)) {
      const event = DirectionBenchmark.event(line);
      if (!event) continue;
      const kind = String(event.item?.type ?? event.type ?? '');
      total.events++;
      if (kind === 'mcp_tool_call' || kind === 'command_execution') total.calls++;
      if (kind === 'agent_message') total.messages++;
      if (kind === 'error' || event.type === 'error')
        total.notices.add(String(event.item?.message ?? 'unspecified error'));
      DirectionBenchmark.account(total, event.usage ?? event.item?.usage);
    }
    return total;
  }

  /** Parses one journal line, ignoring anything the harness wrote that is not JSON. */
  static event(line) {
    try {
      return JSON.parse(line);
    } catch {
      return undefined;
    }
  }

  /** Adds one usage record to the totals, whichever token fields the harness chose to emit. */
  static account(total, usage) {
    if (!usage) return;
    total.input += Number(usage.input_tokens ?? 0);
    total.cached += Number(
      usage.cached_input_tokens ?? usage.input_tokens_details?.cached_tokens ?? 0,
    );
    total.output += Number(usage.output_tokens ?? 0);
    total.reasoning += Number(usage.reasoning_output_tokens ?? 0);
  }

  /** Reads the JSON report from probe output, tolerating any leading warnings. */
  static json(text) {
    const start = text.indexOf('{');
    if (start < 0) return { status: 'failed', problems: ['probe printed no report'] };
    try {
      return JSON.parse(text.slice(start));
    } catch {
      return { status: 'failed', problems: ['probe report was not valid JSON'] };
    }
  }

  /** Reads the scenario list from the corpus file. */
  static scenarios(path) {
    return JSON.parse(readFileSync(path, 'utf8')).scenarios ?? [];
  }

  /** Prints the benchmark table with the suite total. */
  static summary(rows, elapsed) {
    console.log('\n=== benchmark');
    console.table(
      rows.map((row) => ({
        scenario: row.id,
        status: row.status,
        owners: row.owners,
        questions: row.questions,
        problems: row.problems.length,
        seconds: row.seconds,
        events: row.usage.events,
        toolCalls: row.usage.calls,
        messages: row.usage.messages,
        inputTokens: row.usage.input,
        cachedTokens: row.usage.cached,
        outputTokens: row.usage.output,
        reasoningTokens: row.usage.reasoning,
      })),
    );
    const sum = (key) => rows.reduce((total, row) => total + row.usage[key], 0);
    console.log(
      `  ${rows.length} scenarios in ${Math.round(elapsed / 1000)}s · events=${sum('events')} ` +
        `toolCalls=${sum('calls')} input=${sum('input')} cached=${sum('cached')} ` +
        `output=${sum('output')} reasoning=${sum('reasoning')}`,
    );
    const cached = sum('input') ? Math.round((100 * sum('cached')) / sum('input')) : 0;
    console.log(`  cache reuse ${cached}% of input tokens`);
    for (const notice of new Set(rows.flatMap((row) => [...row.usage.notices])))
      console.log(`  notice: ${notice}`);
  }

  /** Parses `--flag value` arguments. */
  static flags(args) {
    const flags = new Map();
    for (let i = 0; i < args.length; i += 2) flags.set(args[i], args[i + 1]);
    return flags;
  }
}

// Only the command line runs the suite; importing the class must not launch twelve activations.
if (process.argv[1] === fileURLToPath(import.meta.url))
  new DirectionBenchmark(process.argv.slice(2)).run().catch((error) => {
    console.error('direction benchmark failed: ' + String(error));
    process.exitCode = 2;
  });
