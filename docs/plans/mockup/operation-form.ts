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
  return `${purposeSection(operation)}
    <fieldset class="arc-yaml-group"><legend>Operation</legend>
    ${identity}
    <div class="arc-form-grid">${operationField('command', operation)}${operationField('cwd', operation)}</div></fieldset>
    <fieldset class="arc-yaml-group"><legend>Arguments</legend>
    <div class="arc-sort-list" data-sortable-list="argument">${operation.args.map(argumentRow).join('')}</div>
    ${addButton('argument', 'Add argument')}</fieldset>
    <fieldset class="arc-yaml-group"><legend>Selectors parameter</legend>
    <small>List of strings</small>
    <div class="arc-sort-list" data-sortable-list="default">${operation.parameters.selectors.default.map(defaultRow).join('') || '<small>No default selectors</small>'}</div>
    ${addButton('default', 'Add default selector')}</fieldset>
    <span class="arc-sr" role="status" data-sort-status></span>`;
}

function readOnlyField(label: string, value: string) {
  return `<label>${escape(label)}<input readonly value="${escape(value)}"></label>`;
}

function purposeSection(operation: Operation) {
  const path = ['purpose'];
  const metadata = operationFields.purpose.meta();
  return `<fieldset class="arc-yaml-group">
    <legend id="yaml-purpose-label">${escape(metadata?.title ?? 'Purpose')}</legend>
    <textarea ${fieldAttributes(path)} aria-labelledby="yaml-purpose-label" rows="2">${escape(operation.purpose)}</textarea>
    <small>${escape(metadata?.description)}</small>${fieldError(path)}</fieldset>`;
}

function operationField(key: 'command' | 'cwd', operation: Operation) {
  const metadata = operationFields[key].meta();
  return textField(metadata?.title ?? key, [key], operation[key], metadata?.description);
}

function argumentRow(value: Operation['args'][number], index: number) {
  const path = [...argumentPath, index];
  const kind = typeof value === 'string' ? 'literal' : 'context' in value ? 'owner' : 'selectors';
  const choices: [string, string][] = [
    ['literal', 'Literal text'],
    ['owner', 'Context · owner'],
    ['selectors', 'Parameter · selectors'],
  ];
  const label = 'Argument ' + (index + 1);
  return `<div class="arc-yaml-list-row" data-sort-row>
    ${field(label + ' type', path, `<select data-yaml-kind="${index}">${options(choices, kind)}</select>`)}
    ${listButtons('argument', index)}
    ${typeof value === 'string' ? textField(label + ' value', path, value, '', false) : ''}
  </div>`;
}

function defaultRow(value: string, index: number) {
  return `<div class="arc-yaml-list-row" data-sort-row>
    ${textField('Default selector ' + (index + 1), [...defaultsPath, index], value)}
    ${listButtons('default', index)}
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

function listButtons(list: string, index: number) {
  const row = (list === 'argument' ? 'argument ' : 'default selector ') + (index + 1);
  return `<div class="arc-row arc-yaml-row-actions">
    <button type="button" class="arc-button arc-sort-handle" data-sort-handle
      aria-label="Reorder ${row}" data-arc-tooltip="Drag to reorder ${row}"
      aria-description="Drag to reorder or use the arrow keys"><span class="arc-sort-grip" aria-hidden="true"></span></button>
    <button type="button" class="arc-button" data-yaml-list="${list}" data-yaml-index="${index}"
      aria-label="Remove ${row}" data-arc-tooltip="Remove ${row}">×</button></div>`;
}
