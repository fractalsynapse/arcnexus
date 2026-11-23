import type { ParameterValue, YamlPath } from './yaml-schema.ts';
import { escape, options } from './view.ts';

type ControlOptions = {
  multiline?: boolean;
  number?: boolean;
  description?: string;
  showError?: boolean;
};

export function textField(
  label: string,
  path: YamlPath,
  value: string | number,
  config: ControlOptions = {},
) {
  const input = config.multiline
    ? `<textarea class="arc-purpose-text" ${attributes(path)} rows="2">\n${escape(value)}</textarea>`
    : `<input ${attributes(path)} ${config.number ? 'type="number" step="any"' : ''} value="${escape(value)}">`;
  return field(label, path, input, config.description, config.showError);
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

export function markdownDisclosure(path: YamlPath, label: string) {
  return disclosure(
    path,
    label,
    `<div class="arc-md-edit" data-yaml-markdown role="group" aria-label="${escape(label)}" tabindex="-1" ${attributes(path)}></div>${fieldError(path)}`,
  );
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
  return `<div class="arc-yaml-field"><label>${escape(label)}${input}</label>
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
    return `<div class="arc-yaml-list-row" data-sort-row>
      <div class="arc-yaml-list-fields">${field(value, [...path, i], itemLabel)}</div>
      ${listButtons(key, itemLabel, i)}</div>`;
  });
  return `<div class="arc-sort-list" data-sortable-list="${key}">${rows.join('')}</div>
    <button type="button" class="arc-button" data-yaml-list="${key}"
      data-yaml-seed="${escape(JSON.stringify(seed))}">Add ${escape(label)}</button>`;
}

function listButtons(key: string, label: string, index: number) {
  const name = escape(label);
  return `<div class="arc-row arc-yaml-row-actions">
    <button type="button" class="arc-button arc-sort-handle" data-sort-handle
      aria-label="Reorder ${name}" data-arc-tooltip="Drag to reorder ${name}"
      aria-description="Drag to reorder or use the arrow keys"><span class="arc-sort-grip" aria-hidden="true"></span></button>
    <button type="button" class="arc-button" data-yaml-list="${key}" data-yaml-index="${index}"
      aria-label="Remove ${name}" data-arc-tooltip="Remove ${name}">×</button></div>`;
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
