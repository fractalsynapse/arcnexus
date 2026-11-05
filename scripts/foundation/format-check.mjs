import { writeFileSync } from 'node:fs';
import { FormattingProposal } from './format-proposal.mjs';

// The existing maintained-code formatting coverage has one authored source.
const coverage = [
  'src',
  'tests',
  'scripts',
  'fixtures',
  'experiments/checks',
  'qualification',
  'eslint.config.ts',
];

/** Checks or explicitly formats maintained files within both the requested scope and repository policy. */
class FormatCheck {
  /** Keeps full write mode explicit; managed engineering operations capture only read-only check mode. */
  async run(args) {
    const [mode, ...paths] = args;
    if (!['--check', '--write'].includes(mode)) throw new Error('Expected --check or --write');
    const proposal = await new FormattingProposal(
      paths.length ? paths : coverage,
      coverage,
    ).create();
    for (const change of proposal.changes) {
      if (mode === '--write') writeFileSync(change.path, change.content);
      console.log(`${mode === '--write' ? 'Formatted' : 'Formatting required:'} ${change.path}`);
    }
    if (mode === '--check' && proposal.changes.length) process.exitCode = 1;
    else console.log('All selected maintained files use Prettier code style.');
  }
}

await new FormatCheck().run(process.argv.slice(2));
