import { createContext, createElement as h, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useWorkspaceRoute } from '../../../../packages/ui/src/index.js';
import { guideRoute, type GuideFile, type GuideHistory } from './guide.js';
import { usePlatformSession } from './session.js';
import { useResource } from './resource.js';
import { draftContent, type GuideFields } from './goal-content.js';

const fileScope = createContext<ReturnType<typeof usePlanFileState> | undefined>(undefined);

/** Keep the file's capture, selected revision and unsaved draft shared across its panels. */
export function PlanFileScope({ children }: PropsWithChildren) {
  const file = usePlanFileState();
  return h(fileScope.Provider, { value: file }, children);
}

export function usePlanFile() {
  const file = useContext(fileScope);
  if (!file) throw new Error('Plan file display requires its workspace scope');
  return file;
}

function usePlanFileState() {
  const { path } = useWorkspaceRoute();
  const route = guideRoute(path);
  const { project, token } = usePlatformSession();
  const { collection, base, revision } = fileAddress(route, project);
  const identity = JSON.stringify([base, revision]);
  const state = useFileDraft(identity);
  const query = new URLSearchParams({ revision: revision ?? '' });
  const revisions = useResource<GuideHistory>(base && base + '/revisions?' + query, token);
  if (state.version) query.set('fileRevision', state.version);
  const detail = useResource<GuideFile>(base && base + '?' + query, token);
  return {
    ...state,
    project,
    token,
    route,
    revision,
    base,
    collection,
    query: query.toString(),
    revisions,
    detail,
    draft: detail.value && draftContent(detail.value.content, state.body, state.fields),
  };
}

function useFileDraft(identity: string) {
  const fresh = (version = '') => ({
    identity,
    version,
    editing: false,
    body: undefined as string | undefined,
    fields: {} as GuideFields,
  });
  const [draft, setDraft] = useState(() => fresh());
  const current = draft.identity === identity ? draft : fresh();
  return {
    version: current.version,
    editing: current.editing,
    body: current.body,
    fields: current.fields,
    select: (version: string) => setDraft(fresh(version)),
    edit: (editing: boolean) => setDraft({ ...current, editing }),
    write: (body: string) => setDraft({ ...current, identity, body }),
    setFields: (fields: GuideFields) =>
      setDraft({ ...current, fields: { ...current.fields, ...fields } }),
  };
}

function fileAddress(
  route: ReturnType<typeof guideRoute>,
  project: ReturnType<typeof usePlatformSession>['project'],
) {
  const revision = route?.revision ?? project?.revision;
  const collection =
    project && route ? '/projects/' + encodeURIComponent(project.id) + '/' + route.kind : undefined;
  const base = collection && route ? collection + '/' + encodeURIComponent(route.id) : undefined;
  return { collection, base, revision };
}
