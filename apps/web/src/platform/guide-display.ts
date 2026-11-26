import { createElement as h, useDeferredValue, useState } from 'react';
import { GuideFilters, type GuideFilter } from './guide-filters.js';
import { GuideList } from './guide-list.js';
import { guideRelativePath, type Guide, type GuideCollection } from './guide.js';
import { usePlanResource, type PlanOutcome } from './plan-resource.js';
import { useResource } from './resource.js';

const initial: GuideFilter = {
  kind: 'goals',
  order: 'priority',
  search: '',
  topics: [],
  changed: false,
};

/** Mount the visible collection and keep guide bodies behind the file route. */
export function GuideDisplay() {
  const plan = usePlanResource();
  const { project } = plan;
  const [filter, update] = useState(initial);
  const { files, changed, error } = useGuideCollection(plan, filter);
  if (!project) return h('p', null, 'Select a project to view Plan files.');
  const entries = files.value?.entries ?? [];
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(GuideFilters, {
      filter,
      topics: [...new Set(entries.flatMap((entry) => entry.topics ?? []))].sort(),
      update,
    }),
    error && h('p', { role: 'alert' }, error),
    files.value
      ? h(GuideList, {
          entries: visibleGuides(entries, filter, changed),
          kind: filter.kind,
          project: project.id,
          revision: files.value.revision,
          changed,
        })
      : !error && h('p', { role: 'status' }, 'Loading Plan files…'),
  );
}

function visibleGuides(entries: Guide[], filter: GuideFilter, changed: ReadonlySet<string>) {
  return entries
    .filter(
      (entry) =>
        filter.topics.every((topic) => entry.topics?.includes(topic)) &&
        (!filter.changed || changed.has(entry.path)),
    )
    .sort((left, right) => compare(left, right, filter.order));
}

function compare(left: Guide, right: Guide, order: GuideFilter['order']) {
  const alphabetical = guideRelativePath(left).localeCompare(guideRelativePath(right));
  if (order === 'name') return alphabetical;
  if (order === 'updated')
    return (right.updated ?? '').localeCompare(left.updated ?? '') || alphabetical;
  return (left.priority ?? Infinity) - (right.priority ?? Infinity) || alphabetical;
}

function useGuideCollection(
  {
    project,
    root,
    history,
    recorded,
    execution,
    plan,
    refresh,
  }: ReturnType<typeof usePlanResource>,
  filter: GuideFilter,
) {
  const search = useDeferredValue(filter.search);
  const outcome = useResource<PlanOutcome>(plan && plan + '/outcome', refresh, recorded?.attempt);
  const delivered =
    outcome.value?.outcome?.kind === 'merged' ? outcome.value.outcome.commit : undefined;
  const revision = delivered ?? recorded?.revision ?? (!execution ? project?.revision : undefined);
  const query = new URLSearchParams({ revision: revision ?? '', ...(search.trim() && { search }) });
  const files = useResource<GuideCollection>(
    root && history.value && revision ? root + '/' + filter.kind + '?' + query : undefined,
  );
  return {
    files,
    changed: new Set(outcome.value?.changedPaths),
    error: history.error ?? files.error ?? outcome.error,
  };
}
