import { escape } from './view.ts';
import type { Activity, Component, ParameterValue, YamlPath } from './yaml-schema.ts';
import { group, purposeSection, textField, textList, valueField, yamlList } from './yaml-fields.ts';

export function componentForm(component: Component) {
  return (
    purposeSection(
      component.purpose,
      'Describe the component’s responsibility and boundaries.',
      true,
    ) +
    group(
      'Component',
      `<div class="arc-form-grid">
      <label>Kind<input readonly value="${escape(component.kind)}"></label>
      ${textField('Summary', ['summary'], component.summary ?? '')}</div>`,
    ) +
    acceptanceFields(component) +
    group('Ownership', textList(['owns'], 'owned path', component.owns)) +
    componentDefaults(component.operationParameters) +
    group(
      'Activities',
      Object.entries(component.activities)
        .map(([name, activity]) => activityForm(name, activity))
        .join(''),
    )
  );
}

function acceptanceFields(component: Component) {
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
  return group('Objectives', objectives) + group('Constraints', constraints);
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
  return `<details class="arc-yaml-activity" data-yaml-section="${escape(JSON.stringify(path))}">
    <summary><span>${escape(name)}</span> <small>${actor}</small></summary>
    <div class="arc-yaml-section-body">
      <div class="arc-form-grid">
        ${textField('Role', [...path, 'role'], activity.role)}
        ${activity.executor ? '' : textField('Execution profile', [...path, 'profile'], activity.profile ?? '')}
      </div>
      ${group('Instructions', textList([...path, 'instructions'], 'instruction', activity.instructions, true))}
      ${group('Operations', yamlList([...path, 'operations'], 'operation', activity.operations, operationBinding))}
      ${group('Standards', textList([...path, 'standards'], 'standard', activity.standards))}
      ${group('Verification', textList([...path, 'verification'], 'required check', activity.verification ?? []))}
    </div></details>`;
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
