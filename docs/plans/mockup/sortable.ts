import { SortableLists as SharedSortableLists } from '../../../packages/ui/src/controls/sortable-lists.js';
import { dismissTooltip } from './tooltip.ts';

/** Reuse the UI sorter with the mockup's tooltip lifecycle. */
export class SortableLists extends SharedSortableLists {
  /** Dismiss the mockup tooltip when a row lifts. */
  constructor(container: HTMLElement, reorder: (list: string, from: number, to: number) => void) {
    super(container, reorder, dismissTooltip);
  }
}
