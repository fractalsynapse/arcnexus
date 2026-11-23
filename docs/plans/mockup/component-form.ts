import { parseDocument } from 'yaml';
import { escape } from './view.ts';
import type { Activity, Component, ParameterValue, YamlPath } from './yaml-schema.ts';
import { componentSchema } from './yaml-schema.ts';
import {
  disclosure,
  group,
  markdownDisclosure,
  textField,
  textList,
  valueField,
  yamlList,
} from './yaml-fields.ts';

export function componentForm(component: Component, selected = 'objectives') {
  return (
    group(
      'Component',
      `<label class="arc-yaml-kind">Kind<input readonly value="${escape(component.kind)}"></label>
      ${textField('Summary', ['summary'], component.summary ?? '', {
        multiline: true,
        description: 'Brief description for other agents in the component catalog.',
      })}
      ${markdownDisclosure(['purpose'], 'Purpose')}`,
    ) +
    componentTabs(component, selected) +
    componentDefaults(component.operationParameters) +
    group(
      'Activities',
      Object.entries(component.activities)
        .map(([name, activity]) => activityForm(name, activity))
        .join(''),
    )
  );
}

export function componentReadout(source: string) {
  const component = readComponent(source);
  if (!component) return '';
  const activities = Object.entries(component.activities)
    .map(([name, activity]) =>
      disclosure(
        ['activities', name],
        name,
        activity.instructions
          .map((prose, i) =>
            markdownDisclosure(
              ['activities', name, 'instructions', i],
              'Instruction ' + (i + 1),
              prose,
            ),
          )
          .join(''),
        activity.executor ? 'Host' : 'Agent',
      ),
    )
    .join('');
  return (
    markdownDisclosure(['purpose'], 'Purpose', component.purpose) + group('Activities', activities)
  );
}

function readComponent(source: string) {
  const document = parseDocument(source);
  if (document.errors.length) return undefined;
  try {
    return componentSchema.safeParse(document.toJS()).data;
  } catch {
    return undefined;
  }
}

function componentTabs(component: Component, selected: string) {
  const sections: [string, string, string][] = [
    ...acceptanceFields(component),
    ['ownership', 'Ownership', textList(['owns'], 'owned path', component.owns)],
  ];
  const tabs = sections.map(([key, label]) => {
    const active = key === selected;
    return `<button type="button" role="tab" data-component-tab="${key}" id="component-${key}-tab"
      aria-controls="component-${key}" aria-selected="${active}" tabindex="${active ? 0 : -1}">${label}</button>`;
  });
  const panels = sections.map(
    ([key, , content]) =>
      `<div role="tabpanel" id="component-${key}" aria-labelledby="component-${key}-tab" ${key === selected ? '' : 'hidden'}>
      ${content}</div>`,
  );
  return `<div class="arc-component-tabs">
    <div class="arc-tabs" role="tablist" aria-label="Component details">${tabs.join('')}</div>${panels.join('')}</div>`;
}

function acceptanceFields(component: Component): [string, string, string][] {
  const objectives = yamlList(
    ['objectives'],
    'measure',
    component.objectives ?? [],
    (value, path) => textField('Measure', [...path, 'measure'], value.measure, { multiline: true }),
    { measure: '' },
  );
  const constraints = yamlList(
    ['constraints'],
    'failure condition',
    component.constraints ?? [],
    (value, path) =>
      textField('Failure condition', [...path, 'failure'], value.failure, { multiline: true }),
    { failure: '' },
  );
  return [
    ['objectives', 'Objectives', objectives],
    ['constraints', 'Constraints', constraints],
  ];
}

function componentDefaults(config?: Component['operationParameters']) {
  if (!config) return '';
  return group(
    'Operation defaults',
    Object.entries(config)
      .map(([id, parameters]) =>
        group(id, configuredParameters(['operationParameters', id], parameters)),
      )
      .join(''),
  );
}

function activityForm(name: string, activity: Activity) {
  const path = ['activities', name];
  const actor = activity.executor ? 'Host' : 'Agent';
  return disclosure(
    path,
    name,
    `
      <div class="arc-form-grid">
        ${textField('Role', [...path, 'role'], activity.role)}
        ${activity.executor ? '' : textField('Execution profile', [...path, 'profile'], activity.profile ?? '')}
      </div>
      ${group(
        'Instructions',
        yamlList(
          [...path, 'instructions'],
          'instruction',
          activity.instructions,
          (_, entry, label) =>
            markdownDisclosure(entry, label.charAt(0).toUpperCase() + label.slice(1)),
        ),
      )}
      ${group('Operations', yamlList([...path, 'operations'], 'operation', activity.operations, operationBinding))}
      ${group('Standards', textList([...path, 'standards'], 'standard', activity.standards))}
      ${group('Verification', textList([...path, 'verification'], 'required check', activity.verification ?? []))}
    `,
    actor,
  );
}

function operationBinding(binding: Activity['operations'][number], path: YamlPath, label: string) {
  if (typeof binding === 'string') return textField(label, path, binding);
  return (
    textField(label, [...path, 'operation'], binding.operation) +
    configuredParameters([...path, 'parameters'], binding.parameters ?? {})
  );
}

function configuredParameters(path: YamlPath, parameters: Record<string, ParameterValue>) {
  return Object.entries(parameters)
    .map(([key, value]) => valueField(key, [...path, key], value))
    .join('');
}
