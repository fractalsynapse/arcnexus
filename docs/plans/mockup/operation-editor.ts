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
import { diffBody, draftDiff } from './diff.ts';
import type { Revision } from './model.ts';
import { argumentPath, argumentValues, defaultsPath, operationForm } from './operation-form.ts';
import { operationIssues, ownerTestsPath } from './owner-tests-schema.ts';
import type { Operation, YamlPath } from './owner-tests-schema.ts';
import { noData } from './view.ts';

type Mode = 'Form' | 'Raw';

let editor: OperationEditor | undefined;

export function detachOperationEditor() {
  editor?.detach();
}

export function mountOperationEditor(main: HTMLElement, revision: Revision | undefined) {
  const host = main.querySelector<HTMLElement>('[data-yaml-editor]');
  if (!host || !revision) {
    editor = undefined;
    return;
  }
  if (editor?.revision !== revision) editor = new OperationEditor(revision);
  editor.mount(host, main);
}

export function saveOperationDraft() {
  return editor?.save();
}

/** Own one YAML draft across the form, source editor, and Changes pane. */
class OperationEditor {
  private source: string;
  private document: ReturnType<typeof parseDocument>;
  private mode: Mode;
  private view?: EditorView;
  private host?: HTMLElement;
  private changes?: HTMLElement;
  private status?: HTMLElement;

  /** Start with the selected YAML verbatim and choose the view that can represent it. */
  constructor(readonly revision: Revision) {
    this.source = revision.content;
    this.document = parseDocument(this.source);
    this.mode = operationIssues(this.document).length ? 'Raw' : 'Form';
  }

  /** Bind the editor, draft diff, and Save diagnostics to the current file page. */
  mount(host: HTMLElement, main: HTMLElement) {
    this.host = host;
    this.changes = main.querySelector<HTMLElement>('[data-yaml-changes]') ?? undefined;
    this.status = main.querySelector<HTMLElement>('[data-yaml-save-status]') ?? undefined;
    host.onclick = (event) => this.click(event.target);
    host.oninput = (event) => this.input(event.target);
    this.render();
  }

  /** Dispose of the CodeMirror view while preserving the draft across page renders. */
  detach() {
    this.view?.destroy();
    this.view = undefined;
    this.host = this.changes = this.status = undefined;
  }

  /** Return validated draft bytes or show why Save cannot proceed. */
  save() {
    if (this.validate(parseDocument(this.source))) return this.source;
    if (this.status) this.status.textContent = 'Fix the YAML validation errors before saving.';
    this.host?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return undefined;
  }

  /** Render the active editing mode and restore its validation and diff. */
  private render() {
    if (!this.host) return;
    this.view?.destroy();
    this.view = undefined;
    const body =
      this.mode === 'Form'
        ? operationForm(this.document.toJS() as Operation)
        : '<div class="arc-yaml-raw"></div>';
    this.host.innerHTML = `<div class="arc-row arc-yaml-modes" role="group" aria-label="YAML editing mode">
      ${modeButton('Form', this.mode)}${modeButton('Raw', this.mode)}</div>
      <div class="arc-yaml-error" data-yaml-diagnostics role="status"></div>${body}`;
    const raw = this.host.querySelector<HTMLElement>('.arc-yaml-raw');
    if (raw) this.mountRaw(raw);
    this.refresh();
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
        : diffBody([
            {
              path: ownerTestsPath,
              lines: draftDiff(this.revision.content.split('\n'), this.source.split('\n')),
            },
          ]);
  }

  /** Match Zod issue paths to field diagnostics or the source editor summary. */
  private validate(document = this.document) {
    const issues = operationIssues(document);
    const messages = new Map(issues.map(({ path, message }) => [JSON.stringify(path), message]));
    this.host?.querySelectorAll<HTMLElement>('[data-yaml-field]').forEach((field) => {
      field.setAttribute('aria-invalid', String(messages.has(field.dataset.yamlField ?? '')));
    });
    this.host?.querySelectorAll<HTMLElement>('[data-yaml-error]').forEach((entry) => {
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

  /** Apply one field change and rebuild controls when an argument changes type. */
  private input(target: EventTarget | null) {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const { yamlField, yamlKind } = target.dataset;
    if (yamlKind !== undefined) {
      const index = Number(yamlKind);
      this.set(
        [...argumentPath, index],
        argumentValues[target.value as keyof typeof argumentValues],
      );
      this.render();
      this.focusRow(argumentPath, index);
    } else if (yamlField) {
      const value =
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : target.value;
      this.set(JSON.parse(yamlField) as YamlPath, value);
      this.refresh();
    }
  }

  /** Update one YAML node while retaining its comments and surrounding document. */
  private set(path: YamlPath, value: unknown) {
    const original = this.document.getIn(path, true);
    if (isScalar(original) && (typeof value === 'string' || typeof value === 'boolean')) {
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
    const yaml = this.document.toString({ indentSeq: false, lineWidth: 0 });
    this.source = this.source.includes('\r\n') ? yaml.replace(/\n/g, '\r\n') : yaml;
  }

  /** Handle mode changes and list actions without re-rendering the file page. */
  private click(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const control = target.closest('button');
    if (!control) return;
    const { yamlMode, yamlAdd, yamlList, yamlIndex, yamlAction } = control.dataset;
    if (yamlMode === 'Form' || yamlMode === 'Raw') {
      if (this.mode === yamlMode || (yamlMode === 'Form' && !this.validate())) return;
      this.mode = yamlMode;
      this.render();
      this.host?.querySelector<HTMLElement>(`[data-yaml-mode="${yamlMode}"]`)?.focus();
    } else if (yamlAdd || (yamlList && yamlAction && yamlIndex !== undefined)) {
      const list = yamlAdd ?? yamlList;
      this.editList(
        list === 'argument' ? argumentPath : defaultsPath,
        yamlAdd ? 'add' : yamlAction,
        Number(yamlIndex),
      );
    }
  }

  /** Move or change list entries in place so retained nodes keep their YAML metadata. */
  private editList(path: string[], action: string | undefined, index: number) {
    const list = this.document.getIn(path, true);
    if (!isSeq(list)) return;
    let next: number;
    if (action === 'add') {
      next = list.items.length;
      list.items.push(this.document.createNode(''));
    } else if (action === 'remove') {
      list.items.splice(index, 1);
      next = Math.min(index, list.items.length - 1);
    } else {
      next = action === 'up' ? index - 1 : index + 1;
      const [node] = list.items.splice(index, 1);
      list.items.splice(next, 0, node);
    }
    this.serialize();
    this.render();
    this.focusRow(path, next);
  }

  /** Restore focus after rebuilding the list, falling back to its Add button. */
  private focusRow(path: string[], index: number) {
    if (!this.host) return;
    const argument = path === argumentPath;
    const row = argument
      ? this.host.querySelector<HTMLElement>(`[data-yaml-kind="${index}"]`)
      : [...this.host.querySelectorAll<HTMLElement>('[data-yaml-field]')].find(
          (field) => field.dataset.yamlField === JSON.stringify([...path, index]),
        );
    (
      row ??
      this.host.querySelector<HTMLElement>(`[data-yaml-add="${argument ? 'argument' : 'default'}"]`)
    )?.focus();
  }
}

function modeButton(value: Mode, mode: Mode) {
  return `<button type="button" class="arc-button" aria-pressed="${mode === value}" data-yaml-mode="${value}">${value}</button>`;
}
