import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { SourceConfinement } from '../../../dist/library/operations/confinement.js';
import { execute, isObservedCommandFailure } from '../../../dist/library/operations/process.js';
import { registerSuite } from '../../../dist/library/testing/suite.js';
import { MinimalCatalogFixture } from '../../library/testing/support/minimal-catalog-fixture.js';

/** Exercises real Codex thread startup with a denied private home and controlled model transport. */
class RuntimeStartupScenario extends MinimalCatalogFixture {
  private readonly evidence = this.root + '-runtime';

  private readonly home = join(this.evidence, 'private');

  private readonly executable = process.env.ARCNEXUS_TEST_CODEX!;

  private readonly confinement: SourceConfinement;

  private requests = 0;

  private readonly server = createServer((_request, response) => {
    this.requests++;
    response.writeHead(400, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'Qualification transport reached' } }));
  });

  /** Keeps model state outside maintained source and closes every owned test resource. */
  constructor(t: TestContext) {
    super(t);
    mkdirSync(this.home, { recursive: true, mode: 0o700 });
    writeFileSync(join(this.home, 'credential-marker'), 'private qualification marker');
    this.put('AGENTS.md', 'Read-only runtime qualification; do not change source.\n');
    this.git('add', '.');
    this.git('commit', '-qm', 'Capture startup instructions');
    this.confinement = new SourceConfinement({
      workspace: this.root,
      reads: ['.'],
      outputs: [],
      temporaryRoot: join(this.evidence, 'temporary'),
      executable: this.executable,
      toolDirectories: [dirname(this.executable)],
      protectedPaths: [this.home],
    });
    t.after(() => this.server.close());
    t.after(() => rmSync(this.evidence, { recursive: true, force: true }));
  }

  /** Requires actual instruction loading and thread creation before the intentionally rejected model request. */
  async startup(signal: AbortSignal): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    const address = this.server.address();
    assert.ok(address && typeof address === 'object');
    const configuration = this.configuration(address.port);
    const log = join(this.evidence, 'startup.log');
    const args = [
      'exec',
      '--experimental-json',
      '--model',
      'qualification',
      '-C',
      this.root,
      ...configuration.flatMap((value) => ['-c', value]),
      'Reply OK.',
    ];
    await assert.rejects(
      execute({ command: this.executable, args }, this.root, log, signal, {
        processScope: true,
        env: this.environment(),
      }),
      (error) => isObservedCommandFailure(error) && error.commandResult.exitCode === 1,
    );
    const output = readFileSync(log, 'utf8');
    assert.match(output, /"type":"thread.started"/);
    assert.match(output, /Qualification transport reached/);
    assert.doesNotMatch(output, /fs sandbox helper failed/);
    assert.equal(this.requests, 1);
    await this.denials(signal);
  }

  /** Changes only the external model transport; filesystem authority comes from the production adapter. */
  private configuration(port: number): string[] {
    return [
      ...this.confinement.overrides,
      'model_provider="qualification"',
      'model_providers.qualification.name="qualification"',
      `model_providers.qualification.base_url="http://127.0.0.1:${port}/v1"`,
      'model_providers.qualification.env_key="ARCNEXUS_QUALIFICATION_KEY"',
      'model_providers.qualification.wire_api="responses"',
      'approval_policy="never"',
    ];
  }

  /** Supplies a non-secret key only to the loopback test provider, without inheriting caller credentials. */
  private environment(): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH,
      HOME: this.evidence,
      CODEX_HOME: this.home,
      TMPDIR: this.confinement.temporaryRoot,
      ARCNEXUS_QUALIFICATION_KEY: 'qualification-not-a-secret',
    };
  }

  /** Verifies startup did not require exposing private bytes or granting direct maintained-source writes. */
  private async denials(signal: AbortSignal): Promise<void> {
    const source = join(this.root, 'AGENTS.md');
    const before = readFileSync(source, 'utf8');
    const program = `const fs=require('fs');let denied=0;
      try{fs.readFileSync(${JSON.stringify(join(this.home, 'credential-marker'))});}catch{denied++;}
      try{fs.writeFileSync(${JSON.stringify(source)},'unauthorized');}catch{denied++;}
      if(denied!==2)process.exit(1);`;
    await execute(
      this.confinement.command({ command: process.execPath, args: ['-e', program] }),
      this.root,
      join(this.evidence, 'denials.log'),
      signal,
      { processScope: true, env: this.confinement.environment(this.environment()) },
    );
    assert.equal(readFileSync(source, 'utf8'), before);
  }
}

test(
  'real runtime starts with private credentials denied and source read-only',
  {
    skip:
      !process.env.ARCNEXUS_TEST_CODEX &&
      'Requires installed native runtime and process supervision',
    timeout: 60_000,
  },
  async (t) => new RuntimeStartupScenario(t).startup(t.signal),
);

registerSuite({ component: 'release', level: 'acceptance', tags: ['native-host', 'confinement'] });
