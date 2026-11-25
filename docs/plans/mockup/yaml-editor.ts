import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { yaml } from '@codemirror/lang-yaml';
import { syntaxHighlighting } from '@codemirror/language';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { isNode, isScalar, isSeq, parseDocument } from 'yaml';
import type { Scalar } from 'yaml';
import { diffBody, draftDiff } from './diff.ts';
import { mountMarkdownField } from './mdx-editor.ts';
import type { DesignFile, Revision } from './model.ts';
import { componentForm } from './component-form.ts';
import { operationForm } from './operation-form.ts';
import { prepareComponentDraft, prepareOperationDraft, yamlIssues } from './yaml-schema.ts';
import type { Component, Operation, YamlPath } from './yaml-schema.ts';
import { SortableLists } from './sortable.ts';
import { selectTab } from './tab-controls.ts';
import { noData } from './view.ts';

type Mode = 'Form' | 'Raw';

let editor: YamlEditor | undefined;

export function detachYamlEditor() {
  editor?.detach();
}

export function mountYamlEditor(
  main: HTMLElement,
  file: DesignFile | undefined,
  revision: Revision | undefined,
) {
  const host = main.querySelector<HTMLElement>('[data-yaml-editor]');
  if (!host || !file || !revision) {
    editor = undefined;
    return;
  }
  if (editor?.revision !== revision) editor = new YamlEditor(file, revision);
  editor.mount(host, main);
}

export function saveYamlDraft() {
  return editor?.save();
}

export function mountYamlMarkdownField(host: HTMLElement) {
  editor?.mountMarkdown(host);
}

/** Own one YAML draft across the form, source editor, and Changes pane. */
class YamlEditor {
  private source: string;
  private document: ReturnType<typeof parseDocument>;
  private mode: Mode;
  private view?: EditorView;
  private host?: HTMLElement;
  private changes?: HTMLElement;
  private status?: HTMLElement;
  private sorter?: SortableLists;
  private componentTab?: string;
  private readonly sections = new Map<string, boolean>();
  private readonly markdownViews = new Map<HTMLElement, () => void>();

  /** Prepare an editable draft of the selected architecture file. */
  constructor(
    private readonly file: DesignFile,
    readonly revision: Revision,
  ) {
    this.source = revision.content;
    this.document = parseDocument(this.source);
    if (!this.document.errors.length) {
      const prepared = file.type === 'Operation'
        ? prepareOperationDraft(this.document)
        : prepareComponentDraft(this.document);
      if (prepared) this.serialize();
    }
    this.mode = yamlIssues(this.document, file).length ? 'Raw' : 'Form';
  }

  /** Bind the editor, draft diff, and Save diagnostics to the current file page. */
  mount(host: HTMLElement, main: HTMLElement) {
    this.host = host;
    this.changes = main.querySelector<HTMLElement>('[data-yaml-changes]') ?? undefined;
    this.status = main.querySelector<HTMLElement>('[data-yaml-save-status]') ?? undefined;
    host.onclick = (event) => this.click(event.target);
    host.oninput = (event) => this.input(event.target);
    host.addEventListener('toggle', this.mountExpandedFields, true);
    this.sorter = new SortableLists(host, (list, from, to) => this.reorder(list, from, to));
    this.render();
  }

  /** Dispose of the CodeMirror view while preserving the draft across page renders. */
  detach() {
    this.rememberSections();
    this.host?.removeEventListener('toggle', this.mountExpandedFields, true);
    this.unmountMarkdownFields();
    this.sorter?.dispose();
    this.sorter = undefined;
    this.view?.destroy();
    this.view = undefined;
    this.host = this.changes = this.status = undefined;
  }

  /** Return validated draft bytes or show why Save cannot proceed. */
  save() {
    if (this.validate(parseDocument(this.source))) return this.source;
    if (this.status) this.status.textContent = 'Fix the YAML validation errors before saving.';
    const invalid = this.host?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid) this.revealField(invalid);
    return undefined;
  }

  /** Render the active editing mode and restore its validation and diff. */
  private render() {
    if (!this.host) return;
    this.rememberSections();
    this.unmountMarkdownFields();
    this.sorter?.cancel();
    this.view?.destroy();
    this.view = undefined;
    const body =
      this.mode === 'Form'
        ? this.form() + '<span class="arc-sr" role="status" data-sort-status></span>'
        : '<div class="arc-yaml-raw"></div>';
    this.host.innerHTML = `<div class="arc-row arc-yaml-modes" role="group" aria-label="YAML editing mode">
      ${modeButton('Form', this.mode)}${modeButton('Raw', this.mode)}</div>
      <div class="arc-yaml-error" data-yaml-diagnostics role="status"></div>${body}`;
    this.host.querySelectorAll<HTMLDetailsElement>('[data-yaml-section]').forEach((section) => {
      const open = this.sections.get(section.dataset.yamlSection ?? '');
      if (open !== undefined) section.open = open;
    });
    const raw = this.host.querySelector<HTMLElement>('.arc-yaml-raw');
    if (raw) this.mountRaw(raw);
    this.mountExpandedFields();
    this.refresh();
  }

  /** Render the active catalog family from the draft document. */
  private form() {
    const value: unknown = this.document.toJS();
    return this.file.type === 'Operation'
      ? operationForm(value as Operation)
      : componentForm(value as Component, this.componentTab);
  }

  /** Keep the selected sections open across list edits and mode changes. */
  private rememberSections() {
    const active = this.host?.querySelector<HTMLElement>(
      '[data-component-tab][aria-selected="true"]',
    );
    this.componentTab = active?.dataset.componentTab ?? this.componentTab;
    this.host?.querySelectorAll<HTMLDetailsElement>('[data-yaml-section]').forEach((section) => {
      this.sections.set(section.dataset.yamlSection ?? '', section.open);
    });
  }

  /** Mount the shared editor only for prose fields the operator has expanded. */
  private readonly mountExpandedFields = () => {
    for (const field of this.host?.querySelectorAll<HTMLElement>('[data-yaml-markdown]') ?? []) {
      if (!field.closest('details:not([open])')) this.mountMarkdown(field);
    }
  };

  /** Share one editor and draft between inline and fullscreen views of the field. */
  mountMarkdown(field: HTMLElement) {
    if (this.markdownViews.has(field) || !field.dataset.yamlField) return;
    const path = JSON.parse(field.dataset.yamlField) as YamlPath;
    const body = this.document.getIn(path);
    if (typeof body !== 'string') return;
    this.markdownViews.set(
      field,
      mountMarkdownField(field, body, (updated) => {
        this.set(path, updated);
        this.refresh();
      }),
    );
  }

  /** Detach each Markdown root before replacing or leaving the form. */
  private unmountMarkdownFields() {
    for (const unmount of this.markdownViews.values()) unmount();
    this.markdownViews.clear();
  }

  /** Listen for source edits and parse them for validation without rewriting the text. */
  private mountRaw(parent: HTMLElement) {
    this.view = new EditorView({
      parent,
      doc: this.source,
      extensions: [
        yaml(),
        syntaxHighlighting(classHighlighter),
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.contentAttributes.of({ 'aria-label': 'Raw YAML' }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          this.source = update.state.doc.toString();
          this.document = parseDocument(this.source);
          this.refresh();
        }),
      ],
    });
  }

  /** Update errors and the preview comparison after an edit. */
  private refresh() {
    this.validate();
    if (this.status) this.status.textContent = '';
    if (!this.changes) return;
    this.changes.innerHTML =
      this.source === this.revision.content
        ? noData('No draft changes yet.')
        : diffBody({
            file: {
              path: this.file.path,
              lines: draftDiff(this.revision.content.split('\n'), this.source.split('\n')),
            },
          });
  }

  /** Match Zod issue paths to field diagnostics or the source editor summary. */
  private validate(document = this.document) {
    const issues = yamlIssues(document, this.file);
    const messages = new Map(issues.map(({ path, message }) => [JSON.stringify(path), message]));
    const scope = this.host?.closest('#arc-preview');
    scope?.querySelectorAll<HTMLElement>('[data-yaml-field]').forEach((field) => {
      field.setAttribute('aria-invalid', String(messages.has(field.dataset.yamlField ?? '')));
    });
    scope?.querySelectorAll<HTMLElement>('[data-yaml-error]').forEach((entry) => {
      const key = entry.dataset.yamlError ?? '';
      entry.textContent = messages.get(key) ?? '';
      messages.delete(key);
    });
    const diagnostics = this.host?.querySelector('[data-yaml-diagnostics]');
    if (diagnostics)
      diagnostics.textContent = issues
        .filter(({ path }) => messages.has(JSON.stringify(path)))
        .map(({ path, message }) => (path.length ? `${path.join('.')} · ${message}` : message))
        .join('\n');
    return !issues.length;
  }

  /** Apply a typed field edit and keep the current control focused. */
  private input(target: EventTarget | null) {
    const isField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement;
    if (!isField || !target.dataset.yamlField) return;
    const path = JSON.parse(target.dataset.yamlField) as YamlPath;
    if (path[0] === 'activityFlow' && path[1] === 'participation') {
      this.changeParticipation(String(path[2]), target.value);
      return;
    }
    if (target.dataset.yamlValues) {
      const values = JSON.parse(target.dataset.yamlValues) as Record<string, unknown>;
      if (!Object.hasOwn(values, target.value)) return;
      this.set(path, values[target.value]);
      this.render();
      this.host
        ?.querySelector<HTMLElement>(`[data-yaml-field="${CSS.escape(JSON.stringify(path))}"]`)
        ?.focus();
      return;
    }
    this.set(path, fieldValue(target));
    this.refresh();
  }

  /** Move an existing activity reference between flow groups. */
  private changeParticipation(id: string, participation: string) {
    const sequence = this.document.getIn(['activityFlow', 'sequence'], true);
    const requested = this.document.getIn(['activityFlow', 'requested'], true);
    if (!isSeq(sequence) || !isSeq(requested)) return;
    let entry: Scalar = this.document.createNode(id);
    for (const list of [sequence, requested]) {
      const index = list.items.findIndex((item) => isScalar(item) && item.value === id);
      const node = index < 0 ? undefined : list.items.splice(index, 1)[0];
      if (isScalar(node)) entry = node;
    }
    if (participation === 'sequence') sequence.items.push(entry);
    if (participation === 'requested') requested.items.push(entry);
    this.serialize();
    this.render();
    const key = CSS.escape(JSON.stringify(['activityFlow', 'participation', id]));
    const field = this.host?.querySelector<HTMLElement>(`[data-yaml-field="${key}"]`);
    if (field) this.revealField(field);
  }

  /** Update one YAML node while retaining its comments and surrounding document. */
  private set(path: YamlPath, value: unknown) {
    const original = this.document.getIn(path, true);
    if (
      isScalar(original) &&
      (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
    ) {
      if (original.value === value) return;
      original.value = value;
    } else {
      const replacement = this.document.createNode(value);
      if (isNode(original) && isNode(replacement)) {
        replacement.comment = original.comment;
        replacement.commentBefore = original.commentBefore;
        replacement.spaceBefore = original.spaceBefore;
      }
      this.document.setIn(path, replacement);
    }
    this.serialize();
  }

  /** Write form changes back to the draft with its original newline convention. */
  private serialize() {
    const format =
      this.file.type === 'Component'
        ? { flowCollectionPadding: false }
        : { indentSeq: false, lineWidth: 0 };
    const yaml = this.document.toString(format);
    this.source = this.source.includes('\r\n') ? yaml.replace(/\n/g, '\r\n') : yaml;
  }

  /** Handle mode changes and list actions without re-rendering the file page. */
  private click(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const control = target.closest('button');
    if (!control) return;
    const { yamlMode, yamlList, yamlIndex, yamlSeed } = control.dataset;
    if (yamlMode === 'Form' || yamlMode === 'Raw') {
      if (this.mode === yamlMode || (yamlMode === 'Form' && !this.validate())) return;
      if (yamlMode === 'Form' && this.file.type === 'Component' && prepareComponentDraft(this.document))
        this.serialize();
      this.mode = yamlMode;
      this.render();
      this.host?.querySelector<HTMLElement>(`[data-yaml-mode="${yamlMode}"]`)?.focus();
    } else if (yamlList) {
      const path = JSON.parse(yamlList) as YamlPath;
      const index = yamlIndex === undefined ? undefined : Number(yamlIndex);
      this.editList(path, index, yamlSeed === undefined ? '' : JSON.parse(yamlSeed));
    }
  }

  /** Add or remove an entry while retaining the surrounding YAML nodes. */
  private editList(path: YamlPath, index: number | undefined, seed: unknown) {
    if (!this.document.hasIn(path)) this.document.setIn(path, []);
    const list = this.document.getIn(path, true);
    if (!isSeq(list)) return;
    let next: number;
    if (index === undefined) {
      next = list.items.length;
      list.items.push(this.document.createNode(seed));
    } else {
      list.items.splice(index, 1);
      next = Math.min(index, list.items.length - 1);
    }
    this.serialize();
    this.render();
    this.focusRow(path, next);
  }

  /** Move the existing YAML node so associated comments follow the reordered entry. */
  private reorder(key: string, from: number, to: number) {
    const list = this.document.getIn(JSON.parse(key) as YamlPath, true);
    if (!isSeq(list)) return;
    const [node] = list.items.splice(from, 1);
    list.items.splice(to, 0, node);
    this.serialize();
    this.render();
  }

  /** Restore focus after rebuilding the list, falling back to its Add button. */
  private focusRow(path: YamlPath, index: number) {
    const key = CSS.escape(JSON.stringify(path));
    const rows = this.host?.querySelectorAll(`[data-sortable-list="${key}"] > [data-sort-row]`);
    const entry = rows?.[index]?.querySelector<HTMLElement>('[data-yaml-field]');
    if (entry) this.revealField(entry);
    else
      this.host?.querySelector<HTMLElement>(`[data-yaml-list="${key}"][data-yaml-seed]`)?.focus();
  }

  /** Reveal the tab and disclosures that contain an added or invalid field. */
  private revealField(field: HTMLElement) {
    const panel = field.closest<HTMLElement>('[role="tabpanel"]');
    const tab = this.host?.querySelector<HTMLButtonElement>(
      `[data-component-tab][aria-controls="${CSS.escape(panel?.id ?? '')}"]`,
    );
    if (panel?.hidden && tab) selectTab(tab);
    let section = field.closest('details');
    while (section) {
      section.open = true;
      section = section.parentElement?.closest('details') ?? null;
    }
    this.mountExpandedFields();
    field.focus();
  }
}

function fieldValue(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (target instanceof HTMLInputElement && target.type === 'checkbox') return target.checked;
  if (
    target instanceof HTMLInputElement &&
    target.type === 'number' &&
    Number.isFinite(target.valueAsNumber)
  )
    return target.valueAsNumber;
  return target.value;
}

function modeButton(value: Mode, mode: Mode) {
  return `<button type="button" class="arc-button" aria-pressed="${mode === value}" data-yaml-mode="${value}">${value}</button>`;
}
