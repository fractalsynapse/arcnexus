import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EvidencePages } from './evidence-pages.js';

/** Host-projected worker observations; no caller-supplied path is accepted. */
export interface ReferencedExecutionEvidence {
  assignments?: Array<{
    id: string;
    record?: { recordId?: string; observations?: { timeline?: { events?: any[] } } };
  }>;
}

/** Repins observed investigation artifacts without recursively expanding historical verification evidence. */
export class ReferencedEvidence {
  private readonly retained = new Map<string, { id: string; content: string }>();

  /** Binds source lookup to the host's private store and current immutable run identity. */
  constructor(
    private readonly root: string,
    private readonly runId: string,
    private readonly pages: EvidencePages,
  ) {}

  /** Annotates cloned observations only; retained reports and original artifact names remain unchanged. */
  index(evidence: ReferencedExecutionEvidence): void {
    for (const assignment of evidence.assignments ?? []) {
      for (const event of assignment.record?.observations?.timeline?.events ?? []) {
        const item = event.payload?.item;
        if (
          event.type !== 'codex.event' ||
          event.payload?.type !== 'item.completed' ||
          item?.type !== 'mcp_tool_call' ||
          item.server !== 'arcnexus' ||
          item.tool !== 'assignment.evidence' ||
          item.result?.contentRetainedInPinnedArtifact !== true
        )
          continue;
        const recordId = assignment.record?.recordId;
        if (event.runId !== recordId) throw new Error('Foreign investigation observation');
        this.reference(recordId, assignment.id, item.result);
      }
    }
  }

  /** Verifies originating identity and exposes the observed manifest's immediate artifacts only. */
  private reference(recordId: string | undefined, assignmentId: string, result: any): void {
    if (!recordId || !/^[a-f0-9-]{36}$/.test(recordId))
      throw new Error('Invalid investigation record identity');
    const directory = join(this.root, 'runs', recordId);
    const record = JSON.parse(this.read(join(directory, 'report.json')));
    if (
      record.id !== recordId ||
      record.executionRunId !== this.runId ||
      record.assignmentId !== assignmentId
    )
      throw new Error('Investigation record belongs to a different run or assignment');
    const content = this.pin(directory, recordId, result);
    if (content !== undefined && result.artifact === 'manifest')
      result.verificationArtifacts = this.manifest(directory, recordId, assignmentId, content);
  }

  /** Makes unread artifacts advertised by the observed manifest independently inspectable without recursion. */
  private manifest(directory: string, recordId: string, assignmentId: string, content: string) {
    const manifest = JSON.parse(content);
    if (
      manifest.runId !== this.runId ||
      manifest.assignmentId !== assignmentId ||
      !Array.isArray(manifest.artifacts)
    )
      throw new Error('Investigation manifest belongs to a different run or assignment');
    return manifest.artifacts.map((artifact: any) => {
      if (typeof artifact.id !== 'string')
        throw new Error('Invalid investigation artifact identity');
      const reference = { artifact: artifact.id, sha256: artifact.sha256 };
      this.pin(directory, recordId, reference);
      return reference;
    });
  }

  /** Reuses immutable content for repeated pages while preserving exact original bytes and current IDs. */
  private pin(directory: string, recordId: string, result: any): string | undefined {
    if (typeof result.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(result.sha256))
      throw new Error('Invalid investigation artifact hash');
    const id = `observed:${recordId}:${result.sha256}`;
    const retained = this.retained.get(id);
    if (retained) {
      result.verificationArtifact = retained.id;
      return retained.content;
    }
    const content = this.artifact(join(directory, 'assignment-evidence', result.sha256), result);
    if (content === undefined) return;
    this.pages.add(id, content, 'utf8');
    this.retained.set(id, { id, content });
    result.verificationArtifact = id;
    return content;
  }

  /** Missing retained bytes stay explicit gaps; corruption and unsafe aliases remain capture failures. */
  private artifact(path: string, result: any): string | undefined {
    let content: string;
    try {
      content = this.read(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      result.evidenceUnavailable = true;
      result.reason = 'Observed investigation artifact is no longer retained';
      return;
    }
    if (createHash('sha256').update(content).digest('hex') !== result.sha256)
      throw new Error('Investigation artifact differs from its content identity');
    return content;
  }

  /** Rejects symlinked ancestors, shared inodes and non-regular files before exposing any bytes. */
  private read(path: string): string {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.nlink !== 1 || realpathSync(path) !== resolve(path))
      throw new Error('Unsafe investigation evidence path');
    return readFileSync(path, 'utf8');
  }
}
