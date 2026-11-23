import type { Operation, YamlPath } from './yaml-schema.ts';
import { escape } from './view.ts';
import {
  checkbox,
  group,
  purposeSection,
  selectField,
  textField,
  yamlList,
} from './yaml-fields.ts';

export function operationForm(operation: Operation) {
  const kind = `<label>Kind<input readonly value="${escape(operation.kind)}"></label>`;
  return (
    purposeSection(
      operation.purpose,
      operation.tool
        ? 'Describe when Codex should choose this operation.'
        : 'Describe why the host runs this operation.',
    ) + (operation.kind === 'tool' ? group('Operation', kind) : commandForm(operation, kind))
  );
}

function commandForm(operation: Operation, kind: string) {
  const settings = `<div class="arc-form-grid">${kind}
    ${checkbox('Network access', ['network'], operation.network === true)}
    ${textField('Command', ['command'], operation.command ?? '', { description: 'Executable name' })}
    ${textField('Working directory', ['cwd'], operation.cwd ?? '.', { description: 'Path relative to the repository root' })}
    </div>`;
  const parameters = Object.entries(operation.parameters ?? {});
  const argumentsList = yamlList(['args'], 'argument', operation.args ?? [], (value, path, label) =>
    argumentField(
      value,
      path,
      label,
      parameters.map(([name]) => name),
    ),
  );
  return (
    group('Operation', settings) +
    group('Arguments', argumentsList) +
    parameters.map(([name, parameter]) => parameterSection(name, parameter)).join('')
  );
}

type Argument = NonNullable<Operation['args']>[number];
type Parameter = NonNullable<Operation['parameters']>[string];

function argumentField(value: Argument, path: YamlPath, label: string, parameters: string[]) {
  const kind =
    typeof value === 'string'
      ? 'literal'
      : 'context' in value
        ? 'owner'
        : 'parameter:' + value.parameter;
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  const choices: [string, string][] = [
    ['literal', 'Literal text'],
    ['owner', 'Context · owner'],
    ...parameters.map<[string, string]>((name) => ['parameter:' + name, 'Parameter · ' + name]),
  ];
  const replacements = Object.fromEntries([
    ['literal', ''],
    ['owner', { context: 'owner' }],
    ...parameters.map((name) => ['parameter:' + name, { parameter: name }]),
  ]);
  return (
    selectField(title + ' type', path, choices, kind, replacements) +
    (typeof value === 'string'
      ? textField(title + ' value', path, value, { showError: false })
      : '')
  );
}

function parameterSection(name: string, parameter: Parameter) {
  const path = ['parameters', name, 'default'];
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  if (parameter.type === 'array') {
    const itemLabel = name.endsWith('s') ? name.slice(0, -1) : name;
    return group(
      label + ' parameter',
      `<small>List of strings</small>
      ${parameter.default?.length ? '' : `<small>No default ${escape(name)}</small>`}
      ${yamlList(path, 'default ' + itemLabel, parameter.default ?? [], (value, entry, title) =>
        textField(title.charAt(0).toUpperCase() + title.slice(1), entry, value),
      )}`,
    );
  }
  const control =
    parameter.type === 'boolean'
      ? checkbox('Default value', path, parameter.default === true)
      : textField('Default value', path, parameter.default ?? '', {
          number: parameter.type === 'number',
        });
  return group(label + ' parameter', `<small>${escape(parameter.type)}</small>${control}`);
}
