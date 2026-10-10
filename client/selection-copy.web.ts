import { useEffect, type RefObject } from "react";

// tsconfig has no DOM lib (plugin scaffold rule), so declare only the browser
// surface this module touches.
export type DomNode = { nodeType: number; parentElement: DomElement | null };
export type DomElement = DomNode & {
  closest(selector: string): DomElement | null;
  contains(node: DomNode | null): boolean;
  getAttribute(name: string): string | null;
  addEventListener(type: "copy", listener: (event: CopyEvent) => void): void;
  removeEventListener(type: "copy", listener: (event: CopyEvent) => void): void;
};
export type DomRange = {
  collapsed: boolean;
  startContainer: DomNode;
  endContainer: DomNode;
  cloneContents(): DomFragment;
};
type DomFragment = {
  textContent: string | null;
  querySelectorAll(selector: string): ArrayLike<
    DomElement & { replaceWith(...nodes: unknown[]): void }
  >;
  ownerDocument: { createTextNode(text: string): unknown };
};
type CopyEvent = {
  clipboardData: { setData(type: string, data: string): void } | null;
  preventDefault(): void;
  stopPropagation(): void;
};
type Selection = { rangeCount: number; getRangeAt(index: number): DomRange };

const ELEMENT_NODE = 1;

function blockOf(node: DomNode, row: DomElement): DomElement | null {
  const element = node.nodeType === ELEMENT_NODE ? (node as DomElement) : node.parentElement;
  const block = element?.closest("[data-q5m-lines]") ?? null;
  return block && row.contains(block) ? block : null;
}

function lines(block: DomElement): [number, number] {
  const [start, end] = (block.getAttribute("data-q5m-lines") ?? "0:0").split(":").map(Number);
  return [start ?? 0, end ?? 0];
}

/**
 * Markdown for a selection made inside one math message row, or null to let the
 * host's default copy run (collapsed, leaves the row, or empty result).
 * Inside one block: null without a formula; with one, the selected text with
 * each formula as its TeX source (one-line block) or the block's source lines.
 * Across blocks: the source lines of every touched block.
 */
export function selectionToMarkdown(
  range: DomRange,
  row: DomElement,
  source: string,
): string | null {
  if (range.collapsed) return null;
  if (!row.contains(range.startContainer) || !row.contains(range.endContainer)) return null;
  const first = blockOf(range.startContainer, row);
  const last = blockOf(range.endContainer, row);
  if (!first || !last) return null;
  const blockSource = () =>
    source
      .split("\n")
      .slice(lines(first)[0], lines(last)[1])
      .join("\n");
  if (first === last) {
    const fragment = range.cloneContents();
    const formulas = Array.from(fragment.querySelectorAll("[data-q5m-math]"));
    // No formula: the default copy is already right, and replacing it would lose
    // separators (RN-web renders bullets and table cells as divs without newlines).
    if (formulas.length === 0) return null;
    // Several source lines (lists, tables): the rendered text has no separators,
    // so copy the block's source lines instead.
    const [start, end] = lines(first);
    if (end - start !== 1) return blockSource();
    for (const formula of formulas) {
      formula.replaceWith(
        fragment.ownerDocument.createTextNode(formula.getAttribute("data-q5m-math") ?? ""),
      );
    }
    return fragment.textContent || null;
  }
  return blockSource();
}

export function useSelectionCopy(rowRef: RefObject<unknown>, source: string): void {
  useEffect(() => {
    const row = rowRef.current as DomElement | null;
    if (!row || typeof row.addEventListener !== "function") return;
    // Milestone 0 (docs/milestone-0.md, Step 4): the host's copy handler runs after
    // this bubbling listener and does not preventDefault for plugin rows.
    const onCopy = (event: CopyEvent) => {
      const selection = (
        globalThis as unknown as { getSelection(): Selection | null }
      ).getSelection();
      if (!selection || selection.rangeCount !== 1) return;
      const markdown = selectionToMarkdown(selection.getRangeAt(0), row, source);
      if (markdown === null || !event.clipboardData) return;
      event.clipboardData.setData("text/plain", markdown);
      event.preventDefault();
      event.stopPropagation();
    };
    row.addEventListener("copy", onCopy);
    return () => row.removeEventListener("copy", onCopy);
  }, [rowRef, source]);
}
