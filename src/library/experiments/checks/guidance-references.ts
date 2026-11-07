import { GuidanceValidator } from '../../guidance-validation/guidance.js';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';

/** Independently checks guidance reference against retained candidate evidence. */
class GuidanceReferenceAcceptance {
  private cli = resolve('dist/cli.js');

  private root = mkdtempSync(join(tmpdir(), 'arcnexus-reference-acceptance-'));

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  run(): void {
    try {
      this.prepare();
      this.check(['docs/diagram.bin'], 0, 'readable binary');
      this.check(undefined, 0, 'legacy');
      this.check(['docs/guide.md'], 0, 'valid');
      for (const [label, references] of Object.entries(this.invalidReferences()))
        this.check(references, 1, label);
      if (process.argv.includes('--combined')) this.combined();
      console.log('Independent references policy acceptance passed');
    } finally {
      rmSync(this.root, { recursive: true, force: true });
    }
  }

  /** Executes the fixture Git command and fails if its expected setup cannot be established. */
  private git(...args: string[]): void {
    const result = spawnSync('git', ['-C', this.root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }

  /** Establishes the prerequisites required by the subsequent execution. */
  private prepare(): void {
    this.git('init', '-q');
    mkdirSync(join(this.root, '.agents/skills/example'), { recursive: true });
    mkdirSync(join(this.root, 'docs'));
    writeFileSync(join(this.root, 'docs/guide.md'), 'Guide');
    writeFileSync(join(this.root, 'untracked.md'), 'Untracked');
    symlinkSync('docs/guide.md', join(this.root, 'link.md'));
    symlinkSync('docs', join(this.root, 'linked-docs'));
    mkdirSync(join(this.root, 'nested'));
    writeFileSync(join(this.root, 'nested/guide.md'), 'Guide');
    this.git('add', 'docs/guide.md', 'link.md', 'linked-docs', 'nested/guide.md');
    rmSync(join(this.root, 'nested'), { recursive: true });
    symlinkSync('docs', join(this.root, 'nested'));
    writeFileSync(join(this.root, 'docs/diagram.bin'), Buffer.from([0xff, 0x00, 0xfe]));
    this.git('add', 'docs/diagram.bin');
  }

  /** Checks the required invariant before allowing the next transition. */
  private check(references: unknown, expected: number, label: string): void {
    const field =
      references === undefined ? '' : 'references: ' + JSON.stringify(references) + '\n';
    writeFileSync(
      join(this.root, '.agents/skills/example/SKILL.md'),
      '---\nname: example\ndescription: Example\n' + field + '---\n# Example\n',
    );
    this.git('add', '.agents/skills/example/SKILL.md');
    const value = new GuidanceValidator().validate(this.root);
    assert.equal(value.status === 'valid' ? 0 : 1, expected, label);
    if (expected === 1)
      assert.ok(
        value.diagnostics.some(
          (diagnostic: any) => diagnostic.path === '.agents/skills/example/SKILL.md',
        ),
      );
  }

  /** Reports malformed guidance references without claiming semantic prose review. */
  private invalidReferences(): Record<string, unknown> {
    return {
      empty: [],
      nullValue: null,
      falseValue: false,
      mapping: { path: 'docs/guide.md' },
      scalar: 'docs/guide.md',
      duplicate: ['docs/guide.md', 'docs/guide.md'],
      absolute: [join(this.root, 'docs/guide.md')],
      traversal: ['docs/../docs/guide.md'],
      escape: ['../guide.md'],
      missing: ['docs/missing.md'],
      untracked: ['untracked.md'],
      directory: ['docs'],
      symlink: ['link.md'],
      parentSymlink: ['nested/guide.md'],
      emptyEntry: [''],
      wrongType: [42],
    };
  }

  /** Checks the assembled guidance and validator change through independent fixtures. */
  private combined(): void {
    const path = 'docs/library/agent-guidance/guidance-maintenance.md';
    const skill = readFileSync('.agents/skills/arcnexus-guidance/SKILL.md', 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill);
    assert.ok(frontmatter, 'ArcNexus guidance must have YAML frontmatter');
    const metadata = parseDocument(frontmatter[1]!, { version: '1.1' });
    assert.deepEqual(metadata.errors, []);
    const { references } = metadata.toJS() as { references?: unknown };
    assert.ok(
      Array.isArray(references) && references.includes(path),
      'ArcNexus guidance must declare the maintenance guide in references',
    );
    const guide = readFileSync(path, 'utf8');
    for (const pattern of [/references/i, /track/i, /readab/i, /integrat/i])
      assert.match(guide, pattern);

    const result = spawnSync(process.execPath, [this.cli, 'validate', '--project', '.'], {
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `ArcNexus validation failed: ${result.signal ?? result.status}`);
  }
}

new GuidanceReferenceAcceptance().run();
