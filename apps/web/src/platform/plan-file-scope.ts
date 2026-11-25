import { createContext, createElement as h, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useWorkspaceRoute } from '../../../../packages/ui/src/index.js';
import { capturedVersion, useFileRevisions } from './file-revisions.js';
import { guideRoute, type GuideFile } from './guide.js';
import { activeSession, setSession, usePlatformSession, type Project } from './session.js';
import { api, useResource } from './resource.js';
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
  const project = useLinkedProject(path, route?.project);
  const { collection, base } = fileAddress(route, project);
  const pinned = route?.revision ?? project?.revision;
  const revisions = useFileRevisions(base, pinned, project?.revision);
  const state = useFileDraft(JSON.stringify([base, pinned, project?.revision]), revisions.initial);
  const { revision, fileRevision } = revisions.address(state.version);
  const query = new URLSearchParams({ revision: revision ?? '' });
  if (fileRevision && state.version && state.version !== capturedVersion)
    query.set('fileRevision', fileRevision);
  const detail = useResource<GuideFile>(base && base + '?' + query);
  return {
    ...state,
    project,
    route,
    revision,
    fileRevision,
    pinned,
    canEdit: !state.version && revision === project?.revision,
    base,
    collection,
    query: query.toString(),
    revisions,
    detail,
    draft: detail.value && draftContent(detail.value.content, state.body, state.fields),
  };
}

/** Reopen a pinned file in its verified catalog project before reading or editing it. */
function useLinkedProject(path: string, id?: string) {
  const { project } = usePlatformSession();
  useEffect(() => {
    const initial = activeSession();
    if (!id || initial.project?.id === id) return;
    const controller = new AbortController();
    void api<Project>('/projects/' + encodeURIComponent(id), { signal: controller.signal }).then(
      (record) => {
        if (!controller.signal.aborted && initial === activeSession() && record.id === id)
          setSession({ project: record });
      },
      () => {},
    );
    return () => controller.abort();
  }, [path, id]);
  return id && id !== project?.id ? undefined : project;
}

function useFileDraft(identity: string, initial: string) {
  const fresh = (version = initial) => ({
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
  const collection =
    project && route ? '/projects/' + encodeURIComponent(project.id) + '/' + route.kind : undefined;
  const base = collection && route ? collection + '/' + encodeURIComponent(route.id) : undefined;
  return { collection, base };
}
