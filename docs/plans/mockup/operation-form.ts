import { operationFields } from './owner-tests-schema.ts';
import type { Operation, YamlPath } from './owner-tests-schema.ts';
import { escape, options } from './view.ts';

export const argumentPath = ['args'];
export const defaultsPath = ['parameters', 'selectors', 'default'];
export const argumentValues = {
  literal: '',
  owner: { context: 'owner' },
  selectors: { parameter: 'selectors' },
} as const;

export function operationForm(operation: Operation) {
  const identity = `<div class="arc-form-grid">
    ${readOnlyField('Kind', operation.kind)}${readOnlyField('Handler', operation.tool)}
    ${readOnlyField('MCP name', operation.id)}${readOnlyField('Network access', 'Disabled')}
  </div>`;
  return `<fieldset class="arc-yaml-group"><legend>Operation</legend>
    ${identity}<div class="arc-form-grid">${Object.entries(operationFields)
      .map(([name, schema]) =>
        operationField(name as keyof typeof operationFields, schema, operation),
      )
      .join('')}</div></fieldset>
    <fieldset class="arc-yaml-group"><legend>Arguments</legend>
    ${operation.args.map(argumentRow).join('')}${addButton('argument', 'Add argument')}</fieldset>
    <fieldset class="arc-yaml-group"><legend>Selectors parameter</legend>
    <small>List of strings</small>
    ${operation.parameters.selectors.default.map(defaultRow).join('') || '<small>No default selectors</small>'}
    ${addButton('default', 'Add default selector')}</fieldset>`;
}

function readOnlyField(label: string, value: string) {
  return `<label>${escape(label)}<input readonly value="${escape(value)}"></label>`;
}

function operationField(
  key: keyof typeof operationFields,
  schema: (typeof operationFields)[keyof typeof operationFields],
  operation: Operation,
) {
  const metadata = schema.meta();
  return textField(metadata?.title ?? key, [key], operation[key], metadata?.description);
}

function argumentRow(value: Operation['args'][number], index: number, all: Operation['args']) {
  const path = [...argumentPath, index];
  const kind = typeof value === 'string' ? 'literal' : 'context' in value ? 'owner' : 'selectors';
  const choices: [string, string][] = [
    ['literal', 'Literal text'],
    ['owner', 'Context · owner'],
    ['selectors', 'Parameter · selectors'],
  ];
  const label = 'Argument ' + (index + 1);
  return `<div class="arc-yaml-list-row">
    ${field(label + ' type', path, `<select data-yaml-kind="${index}">${options(choices, kind)}</select>`)}
    ${listButtons('argument', index, all.length)}
    ${typeof value === 'string' ? textField(label + ' value', path, value, '', false) : ''}
  </div>`;
}

function defaultRow(value: string, index: number, all: string[]) {
  return `<div class="arc-yaml-list-row">
    ${textField('Default selector ' + (index + 1), [...defaultsPath, index], value)}
    ${listButtons('default', index, all.length)}
  </div>`;
}

function field(label: string, path: YamlPath, input: string, description = '', showError = true) {
  return `<div class="arc-yaml-field"><label>${escape(label)}${input}</label>
    ${description ? `<small>${escape(description)}</small>` : ''}${showError ? fieldError(path) : ''}</div>`;
}

function textField(
  label: string,
  path: YamlPath,
  value: string,
  description = '',
  showError = true,
) {
  return field(
    label,
    path,
    `<input ${fieldAttributes(path)} value="${escape(value)}">`,
    description,
    showError,
  );
}

function fieldAttributes(path: YamlPath) {
  return `data-yaml-field="${escape(JSON.stringify(path))}" aria-describedby="yaml-error-${path.join('-')}"`;
}

function fieldError(path: YamlPath) {
  return `<small id="yaml-error-${path.join('-')}" class="arc-yaml-error" data-yaml-error="${escape(JSON.stringify(path))}"></small>`;
}

function addButton(list: string, label: string) {
  return `<button type="button" class="arc-button" data-yaml-add="${list}">${label}</button>`;
}

function listButtons(list: string, index: number, length: number) {
  const row = (list === 'argument' ? 'argument ' : 'default selector ') + (index + 1);
  return `<div class="arc-row arc-yaml-row-actions">
    ${listButton(list, index, 'up', `Move ${row} up`, '↑', index === 0)}
    ${listButton(list, index, 'down', `Move ${row} down`, '↓', index === length - 1)}
    ${listButton(list, index, 'remove', `Remove ${row}`, '×', false)}</div>`;
}

function listButton(
  list: string,
  index: number,
  action: string,
  label: string,
  glyph: string,
  disabled: boolean,
) {
  return `<button type="button" class="arc-button" data-yaml-list="${list}" data-yaml-index="${index}"
    data-yaml-action="${action}" aria-label="${label}" data-arc-tooltip="${label}" ${disabled ? 'disabled' : ''}>${glyph}</button>`;
}
