import { existsSync, lstatSync, realpathSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { assertServicesStopped } from '../operations/service-state.js';
import type { RecordData } from './state.js';
import { WorkspaceCleanup } from './cleanup.js';
import {
  operationInvocationsSettled,
  processOwnership,
  reclaimOperationScratch,
} from './operation-scratch.js';

/** Provides host startup reclamation while leaving workspace removal to guarded cleanup. */
export class WorkspaceReclamation {
  /** Binds startup reclamation to the existing canonical application storage root. */
  constructor(private readonly root: string) {
    if (!isAbsolute(root) || realpathSync(root) !== resolve(root))
      throw new Error('Reclamation root must be a canonical application directory');
  }

  /** Reclaims settled abandoned scratch and eligible unlinked workspaces while preserving uncertain resources. */
  reclaim(): { scratch: string[]; workspaces: string[] } {
    const scratch: string[] = [];
    const workspaces: string[] = [];
    const runs = join(this.root, 'runs');
    if (!existsSync(runs) || lstatSync(runs).isSymbolicLink()) return { scratch, workspaces };
    for (const id of readdirSync(runs)) {
      if (!/^[a-f0-9-]{36}$/.test(id)) continue;
      const directory = join(runs, id);
      if (lstatSync(directory).isSymbolicLink()) continue;
      const path = join(directory, 'report.json');
      if (!existsSync(path) || lstatSync(path).isSymbolicLink()) continue;
      const record = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
      if (record.id !== id) continue;
      if (reclaimOperationScratch(this.root, record, false)) scratch.push(id);
      if (this.workspaceEligible(record)) workspaces.push(id);
    }
    return { scratch, workspaces };
  }

  /** Preserves execution-linked workspaces under the existing cleanup retention rule. */
  private workspaceEligible(record: RecordData): boolean {
    if (
      record.executionRunId !== undefined ||
      record.assignmentId !== undefined ||
      !['completed', 'failed', 'cancelled'].includes(record.status)
    )
      return false;
    const owner = record.workspaceOwnerIdentity as { pid?: number; start?: string } | undefined;
    if (!owner || typeof owner.start !== 'string' || typeof owner.pid !== 'number') return false;
    if (processOwnership(owner.pid, owner.start) !== 'absent') return false;
    if (!operationInvocationsSettled(record)) return false;
    try {
      assertServicesStopped(this.root, record.id);
      new WorkspaceCleanup(this.root, record.id).run();
      return true;
    } catch {
      return false;
    }
  }
}
