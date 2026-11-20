#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/** Return explicit guide proposals so real host approval gates control refinement progression. */
class RefinementGateProvider {
  readonly input = readFileSync(0, 'utf8');
  readonly component = parse(
    this.input.split('## Activity\n')[1]!.split('\n\n')[1]!.split('\n\n## Role')[0]!,
  ).component as string;

  /** Emit one distinguishable assessment without answering or bypassing the host decision. */
  run() {
    this.emit({ type: 'fixture.guide-assessment', component: this.component });
    this.emit({
      type: 'item.completed',
      item: { type: 'agent_message', text: JSON.stringify(this.reply()) },
    });
    this.emit({ type: 'turn.completed', usage: { input_tokens: 17, output_tokens: 11 } });
  }

  /** Propose exact goal removal and a template change; Direction still assesses the retained goal. */
  private reply() {
    const citation = { path: 'baseline', quote: 'durable evidence' };
    if (this.component === 'planner')
      return {
        summary: 'Propose removing the baseline goal for human review.',
        ratings: [{
          id: 'baseline', alignment: 'strong', evidence: 'unverified',
          reason: 'The baseline is covered.', sources: [citation], observations: [],
        }],
        comparison: ['The single goal covers the baseline without overlap.'],
        changes: [{ id: 'baseline', content: null }],
        links: [], sources: [citation],
      };
    if (this.component === 'architecture')
      return {
        kind: 'proposal',
        purpose: 'Explain evidence retention in the accepted plan template.',
        consequences: ['Future plans explain evidence retention.'],
        implementation: [],
        changes: [{
          path: '.arc/architecture/plan-template.md',
          content: 'Use the normal five ordered activities.\nRetain complete evidence.\n',
        }],
      };
    return {
      kind: 'satisfied',
      summary: 'Direction assessed the retained baseline after both declined proposals.',
      evidence: [citation],
    };
  }

  /** Preserve all controlled observations in the existing native JSONL evidence path. */
  private emit(event: unknown) {
    process.stdout.write(JSON.stringify(event) + '\n');
  }
}

new RefinementGateProvider().run();
