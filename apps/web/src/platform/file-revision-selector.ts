import { createElement as h } from 'react';
import { SelectField } from '../../../../packages/ui/src/index.js';
import { capturedVersion, historicalRevisions } from './file-revisions.js';
import { shortCommit } from './github-links.js';
import { usePlanFile } from './plan-file-scope.js';
import { recordedTime } from './recorded-time.js';

/** Pick a file version with the same heading control as the Plan run selector. */
export function FileRevisionSelector() {
  const file = usePlanFile();
  if (!file.project) return null;
  return h(SelectField<string>, {
    label: 'File revision',
    value: file.version,
    options: revisionOptions(file),
    onChange: file.select,
    hideLabel: true,
  });
}

function revisionOptions({ project, pinned, revisions }: ReturnType<typeof usePlanFile>) {
  const latest = revisions.latest.value?.revisions ?? [];
  const captured = revisions.captured.value?.revisions ?? [];
  const latestCommit = latest[0]?.revision ?? project?.revision;
  const pinnedCommit = captured[0]?.revision ?? pinned;
  const options = historicalRevisions(latest, captured)
    .filter(({ revision }) => revision !== latestCommit && revision !== pinnedCommit)
    .map(({ revision, updated }) => ({
      value: revision,
      label: revisionLabel(recordedTime(updated), revision),
    }));
  if (revisions.historical) {
    const label = captured[0] ? recordedTime(captured[0].updated) : 'Captured revision';
    options.unshift({ value: capturedVersion, label: revisionLabel(label, pinnedCommit) });
  }
  if (!revisions.latest.error)
    options.unshift({ value: '', label: revisionLabel('Latest revision', latestCommit) });
  return options;
}

function revisionLabel(label: string, revision?: string) {
  return revision ? label + ' (' + shortCommit(revision) + ')' : label;
}
