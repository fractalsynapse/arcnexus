import type { ParameterValue, YamlPath } from './yaml-schema.ts';
import { markdownViewer } from './markdown.ts';
import { escape, icon, options } from './view.ts';

type ControlOptions = {
  multiline?: boolean;
  number?: boolean;
  description?: string;
  showError?: boolean;
  hideLabel?: boolean;
};

export function textField(
  label: string,
  path: YamlPath,
  value: string | number,
  config: ControlOptions = {},
) {
  const attrs = attributes(path) + (config.hideLabel ? ` aria-label="${escape(label)}"` : '');
  const input = config.multiline
    ? `<textarea class="arc-purpose-text" ${attrs} rows="2">\n${escape(value)}</textarea>`
    : `<input ${attrs} ${config.number ? 'type="number" step="any"' : ''} value="${escape(value)}">`;
  return field(config.hideLabel ? '' : label, path, input, config.description, config.showError);
}

export function purposeSection(purpose: string, description: string) {
  const path = ['purpose'];
  const content = `<textarea class="arc-purpose-text" ${attributes(path)} aria-labelledby="yaml-purpose-label" rows="2">\n${escape(purpose)}</textarea>
    <small>${escape(description)}</small>${fieldError(path)}`;
  return `<fieldset class="arc-yaml-group"><legend id="yaml-purpose-label">Purpose</legend>${content}</fieldset>`;
}

export function disclosure(path: YamlPath, label: string, body: string, qualifier = '') {
  const metadata = qualifier ? `<small>${escape(qualifier)}</small>` : '';
  return `<details class="arc-yaml-disclosure" data-yaml-section="${escape(JSON.stringify(path))}">
    <summary><span>${escape(label)}</span>${metadata}</summary>
    <div class="arc-yaml-section-body">${body}</div></details>`;
}

export function markdownDisclosure(path: YamlPath, label: string, prose?: string) {
  const name = escape(label);
  const fullLabel = escape('Open ' + label + ' fullscreen');
  const field =
    prose === undefined
      ? `<div class="arc-md-edit" data-yaml-markdown role="group" aria-label="${name}" tabindex="-1" ${attributes(path)}></div>${fieldError(path)}`
      : markdownViewer(prose);
  const body = `<div data-prose-content>${field}</div>
    <div class="arc-prose-end"><button type="button" class="arc-button" data-action="collapse-prose"
      aria-label="Collapse ${name}">Collapse</button></div>`;
  return `<div class="arc-prose-field">
    <button type="button" class="arc-link arc-prose-open" data-action="open-prose" data-prose-title="${name}"
      aria-label="${fullLabel}" aria-haspopup="dialog" data-arc-tooltip="${fullLabel}">${icon('maximize')}</button>
    ${disclosure(path, label, body)}</div>`;
}

export function checkbox(label: string, path: YamlPath, checked: boolean) {
  return `<div class="arc-yaml-network">
    <label class="arc-checkbox"><input type="checkbox" ${attributes(path)} ${checked ? 'checked' : ''}>${escape(label)}</label>
    ${fieldError(path)}</div>`;
}

export function selectField(
  label: string,
  path: YamlPath,
  choices: [string, string][],
  selected: string,
  values?: Record<string, unknown>,
) {
  const replacements = values ? ` data-yaml-values="${escape(JSON.stringify(values))}"` : '';
  return field(
    label,
    path,
    `<select ${attributes(path)}${replacements}>${options(choices, selected)}</select>`,
    '',
  );
}

function field(label: string, path: YamlPath, input: string, description = '', showError = true) {
  const control = label ? `<label>${escape(label)}${input}</label>` : input;
  return `<div class="arc-yaml-field">${control}
    ${description ? `<small>${escape(description)}</small>` : ''}${showError ? fieldError(path) : ''}</div>`;
}

function attributes(path: YamlPath) {
  const key = JSON.stringify(path);
  return `data-yaml-field="${escape(key)}" aria-describedby="yaml-error-${encodeURIComponent(key)}"`;
}

function fieldError(path: YamlPath) {
  const key = JSON.stringify(path);
  return `<small id="yaml-error-${encodeURIComponent(key)}" class="arc-yaml-error" data-yaml-error="${escape(key)}"></small>`;
}

export function group(label: string, content: string) {
  return `<fieldset class="arc-yaml-group"><legend>${escape(label)}</legend>${content}</fieldset>`;
}

export function yamlList<T>(
  path: YamlPath,
  label: string,
  values: readonly T[],
  field: (value: T, path: YamlPath, label: string) => string,
  seed: unknown = '',
) {
  const key = escape(JSON.stringify(path));
  const rows = values.map((value, i) => {
    const itemLabel = label + ' ' + (i + 1);
    const name = escape(itemLabel);
    return sortableRow(field(value, [...path, i], itemLabel), `${sortHandle(itemLabel)}
      <button type="button" class="arc-button" data-yaml-list="${key}" data-yaml-index="${i}"
        aria-label="Remove ${name}" data-arc-tooltip="Remove ${name}">×</button>`);
  });
  return `${sortableList(key, rows)}
    <button type="button" class="arc-button" data-yaml-list="${key}"
      data-yaml-seed="${escape(JSON.stringify(seed))}">Add ${escape(label)}</button>`;
}

export function reorderableList(path: YamlPath, ids: string[], row: (id: string) => string) {
  const key = escape(JSON.stringify(path));
  return sortableList(key, ids.map((id) => sortableRow(row(id), sortHandle(id))));
}

function sortableList(key: string, rows: string[]) {
  return `<div class="arc-sort-list" data-sortable-list="${key}">${rows.join('')}</div>`;
}

function sortableRow(fields: string, buttons: string) {
  return `<div class="arc-yaml-list-row" data-sort-row>
    <div class="arc-yaml-list-fields">${fields}</div>
    <div class="arc-row arc-yaml-row-actions">${buttons}</div></div>`;
}

function sortHandle(label: string) {
  const name = escape(label);
  return `<button type="button" class="arc-button arc-sort-handle" data-sort-handle
    aria-label="Reorder ${name}" data-arc-tooltip="Drag to reorder ${name}"
    aria-description="Drag to reorder or use the arrow keys"><span class="arc-sort-grip" aria-hidden="true"></span></button>`;
}

export function textList(path: YamlPath, label: string, values: string[], multiline = false) {
  return yamlList(path, label, values, (value, entry, itemLabel) =>
    textField(itemLabel, entry, value, { multiline }),
  );
}

export function valueField(label: string, path: YamlPath, value: ParameterValue) {
  if (Array.isArray(value))
    return `<div><small>${escape(label)}</small>${textList(path, label.toLowerCase(), value)}</div>`;
  if (typeof value === 'boolean') return checkbox(label, path, value);
  return textField(label, path, value, { number: typeof value === 'number' });
}
