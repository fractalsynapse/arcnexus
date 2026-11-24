#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

interface Frame {
  sequence: string;
  observation: Record<string, any>;
}
interface Completion {
  invocation: string;
  round: string;
  report: string;
}

/** Exercise real request preparation and mapped complete-file consumption with controlled responses. */
class RoundConsumer {
  readonly input = readFileSync(0, 'utf8');
  readonly task = parse(
    this.input.split('\n\n## Activity')[0]!.slice(this.input.indexOf('\n\nassignment:') + 2),
  ) as any;
  readonly component = parse(
    this.input.split('## Activity\n')[1]!.split('\n\n')[1]!.split('\n\n## Role')[0]!,
  ).component as string;
  readonly reads = new Map<string, string>();
  readonly completions = new Map<string, Completion>();

  /** Read advertised evidence before responding, preserving exactly what each subprocess consumed. */
  async run() {
    for (const completion of this.task.assignment.completedRounds ?? []) {
      this.completions.set(completion.invocation + ':' + completion.round, completion);
      await this.discover(completion.report);
    }
    const consumption = await this.consume();
    this.emit({
      type: 'fixture.consumption',
      component: this.component,
      consumption,
      input: this.input,
      reads: [...this.reads.keys()],
      executable: process.argv[1],
    });
    if (!this.task.assignment.clarifications?.length) {
      await this.call('ask-question', {
        question: 'Clarify accepted intent for ' + this.component,
      });
      this.emit({ type: 'item.completed', item: { type: 'agent_message', text: '{}' } });
      return;
    }
    this.respond(consumption);
  }

  /** Emit a complete validated actor reply and independently reported usage for this invocation. */
  private respond(consumption: unknown[]) {
    const finding = this.finding(consumption);
    this.emit({
      type: 'item.completed',
      item: {
        type: 'agent_message',
        text: JSON.stringify(this.reply(finding)),
      },
    });
    this.emit({
      type: 'turn.completed',
      usage: {
        input_tokens: this.input.length,
        output_tokens: finding.length,
      },
    });
  }

  /** Follow complete registered indexes and journal frames, never filesystem aliases or previews. */
  private async discover(path: unknown) {
    if (typeof path !== 'string' || !path.startsWith('/') || this.reads.has(path)) return;
    const result = await this.call('read-file', { path });
    const text = result.structuredContent.text as string;
    this.reads.set(path, text);
  }

  /** Decode complete JSON artifacts and the canonical JSONL frames embedded in readable reports. */
  private values(text: string): unknown[] {
    try {
      return [JSON.parse(text)];
    } catch {
      /* A report or timeline can contain JSON lines. */
    }
    return text.split('\n').flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  }

  /** Cite exact originating identities, measurements, findings and full human answers. */
  private async consume() {
    const consumed: unknown[] = [];
    for (const completion of this.completions.values()) {
      await this.discover(completion.report);
      const report = this.reads.get(completion.report)!;
      const frames = this.values(report).filter((value: any) => value?.observation) as Frame[];
      const sources = new Set(
        frames.flatMap((frame) => {
          const observation = frame.observation;
          return [
            observation.nativeStarted?.request,
            observation.nativeEvent?.source,
            observation.clarification?.evidence,
          ].filter((path): path is string => typeof path === 'string');
        }),
      );
      for (const path of sources) await this.discover(path);
      const messages = [...sources].flatMap((path) =>
        this.values(this.reads.get(path)!).flatMap((value: any) =>
          value?.item?.type === 'agent_message'
            ? [{ path, sha256: createHash('sha256').update(value.item.text).digest('hex') }]
            : [],
        ),
      );
      consumed.push({ ...observedRound(completion, frames), sources: [...sources], messages });
    }
    return consumed;
  }

  /** Make actor, prepared request, answer and consumed history distinguishable across attempts. */
  private finding(consumption: unknown[]) {
    return (
      this.component +
      ' finding ' +
      createHash('sha256').update(this.input).digest('hex') +
      '\nComplete answer: ' +
      JSON.stringify(this.task.assignment.clarifications) +
      '\nConsumed originating findings and measurement references: ' +
      JSON.stringify(
        consumption.map((round: any) => ({
          invocation: round.invocation,
          round: round.round,
          report: round.report,
          findings: round.findings,
          messages: round.messages,
          measurements: round.measurements,
        })),
      )
    );
  }

  /** Return valid production actor shapes and real captured citations with no inventory changes. */
  private reply(finding: string) {
    const citation = { path: 'baseline', quote: 'durable evidence' };
    if (this.component === 'planner')
      return {
        summary: finding,
        ratings: [
          {
            id: 'baseline',
            alignment: 'strong',
            evidence: 'unverified',
            reason: finding,
            sources: [citation],
            observations: [],
          },
        ],
        comparison: ['The single goal covers the baseline without overlap.'],
        changes: [],
        links: [],
        sources: [citation],
      };
    return {
      kind: this.component === 'architecture' ? 'no-change' : 'satisfied',
      summary: finding,
      evidence: [citation],
    };
  }

  /** Invoke the actual loopback LocalMcp operation and reject transport or authorization failures. */
  private async call(name: string, args: Record<string, unknown>): Promise<any> {
    const setting = process.argv.find((arg) => arg.startsWith('mcp_servers='));
    if (!setting) throw new Error('Missing native MCP binding');
    const url = JSON.parse(setting.split('url=')[1]!.split(',required=')[0]!);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    const result = (await response.json()) as any;
    if (!response.ok || result.error || result.result?.isError)
      throw new Error('Mapped operation refused: ' + JSON.stringify(result));
    return result.result;
  }

  /** Preserve the complete controlled observations in Execution's normal provider evidence. */
  private emit(value: unknown) {
    process.stdout.write(JSON.stringify(value) + '\n');
  }
}

/** Derive the exact observed sequence indexes from the report the actor read. */
function observedRound(completion: Completion, frames: readonly Frame[]) {
  const measurements = frames.filter(({ observation }) =>
    ['nativeStarted', 'nativeEvent', 'nativeFinished', 'nativeInvocation'].some(
      (key) => key in observation,
    ),
  );
  return {
    ...completion,
    findings: frames.map(({ sequence }) => sequence),
    measurements: measurements.map(({ sequence }) => sequence),
  };
}

await new RoundConsumer().run();
