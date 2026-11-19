import type { HostTask } from '../../execution/src/index.js';

type Finding = ReturnType<HostTask['journal']['findings']>[number];
interface Observation {
  repair?: { reason?: string; milestone?: string; activity?: string };
  stewardRepair?: { diagnostic?: string; scope?: { owner: string; activity: string } };
  outcome?: { kind: string; reason?: string };
}

/** Link a bounded assessment index to complete immutable observations in the existing evidence store. */
export function architectureFindings(task: HostTask) {
  const findings = task.journal.findings();
  const history = task.store(
    'architecture-findings-history.json',
    JSON.stringify(findings, null, 2),
  );
  return task.store(
    'architecture-findings.json',
    JSON.stringify({ history, findings: findings.map(findingPreview) }, null, 2),
  );
}

/** Explicitly label each preview and retain its event identity and full diagnostic length. */
function findingPreview({ id, run, goal, observation }: Finding) {
  const { repair, stewardRepair, outcome } = observation as Observation;
  const diagnostic = repair?.reason ?? stewardRepair?.diagnostic ?? outcome?.reason ?? '';
  return {
    id,
    run,
    goal,
    route: repair ? 'milestone-repair' : stewardRepair ? 'caller-repair' : outcome?.kind,
    scope:
      stewardRepair?.scope ??
      (repair && { milestone: repair.milestone, activity: repair.activity }),
    preview: diagnostic.slice(0, 600),
    characters: diagnostic.length,
  };
}
