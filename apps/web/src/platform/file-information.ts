import { Fragment, createElement as h } from 'react';
import { TopicPicker } from '../../../../packages/ui/src/index.js';
import type { Guide, GuideCollection } from './guide.js';
import { usePlanFile } from './plan-file-scope.js';
import { useResource } from './resource.js';

/** Display the selected revision and share its metadata draft with the editor. */
export function FileInformation() {
  const file = usePlanFile();
  const { detail, project, editing, collection, revision } = file;
  const catalog = useResource<GuideCollection>(
    editing && collection
      ? collection + '?' + new URLSearchParams({ revision: revision ?? '' })
      : undefined,
  );
  if (!project) return h('p', null, 'Select a project to open this file.');
  if (detail.error) return h('p', { role: 'alert' }, detail.error);
  if (!detail.value) return h('p', { role: 'status' }, 'Loading file information…');
  const { entry } = detail.value;
  const topics = [...new Set(catalog.value?.entries.flatMap((item) => item.topics ?? []))].sort();
  return h(
    'div',
    { className: 'arc-file-metadata' },
    h(MetadataInputs, { file, entry }),
    h(FileTopics, { file, entry, topics }),
  );
}

type FileState = ReturnType<typeof usePlanFile>;

function MetadataInputs({ entry, file }: { entry: Guide; file: FileState }) {
  const { fields, editing, setFields } = file;
  return h(
    Fragment,
    null,
    h(
      'label',
      null,
      'Name',
      h('input', {
        value: fields.name ?? entry.name ?? entry.id,
        readOnly: !editing,
        onChange: (event) => setFields({ name: event.currentTarget.value }),
      }),
    ),
    h(PriorityInput, { entry, file }),
  );
}

function FileTopics({ entry, file, topics }: { entry: Guide; file: FileState; topics: string[] }) {
  const { fields, editing, setFields } = file;
  return h(
    'div',
    { className: 'arc-file-topics' },
    editing
      ? h(TopicPicker, {
          options: topics,
          selected: fields.topics ?? entry.topics ?? [],
          change: (topics) => setFields({ topics }),
          creatable: true,
        })
      : h(
          'div',
          { className: 'arc-field' },
          h('span', null, 'Topics'),
          h(
            'div',
            { className: 'arc-guide-topics' },
            (entry.topics ?? []).map((topic) => h('small', { key: topic }, topic)),
          ),
        ),
  );
}

function PriorityInput({ entry, file }: { entry: Guide; file: FileState }) {
  const { fields, editing, setFields } = file;
  return h(
    'label',
    null,
    'Priority',
    h('input', {
      type: 'number',
      value: fields.priority ?? entry.priority ?? '',
      readOnly: !editing,
      onChange: (event) => {
        const priority = event.currentTarget.valueAsNumber;
        if (Number.isSafeInteger(priority)) setFields({ priority });
      },
    }),
  );
}
