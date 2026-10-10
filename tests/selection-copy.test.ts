// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { selectionToMarkdown } from "../client/selection-copy.web.js";

// tsconfig has no DOM lib; type just what this test touches.
type Node_ = object;
type Range_ = { collapsed: boolean };
type Doc = {
  body: { innerHTML: string };
  getElementById(id: string): { firstChild: Node_ } & object;
  createRange(): Range_ & {
    setStart(node: Node_, offset: number): void;
    setEnd(node: Node_, offset: number): void;
  };
};
const document = (globalThis as unknown as { document: Doc }).document;

type Row = Parameters<typeof selectionToMarkdown>[1];
type Rng = Parameters<typeof selectionToMarkdown>[0];

const source = "# Title\n\nArea is $x^2$ here.\n\n- one\n- two";

function row(): Row {
  document.body.innerHTML = `
    <div id="outside">host text</div>
    <div id="row">
      <div data-q5m-lines="0:1"><span id="title">Title</span></div>
      <div data-q5m-lines="2:3"><span id="p1">Area is </span><span data-q5m-math="$x^2$"><img alt=""></span><span id="p2"> here.</span></div>
      <div data-q5m-lines="4:6"><span id="li">one two</span></div>
    </div>`;
  return document.getElementById("row") as unknown as Row;
}

const text = (id: string) => document.getElementById(id).firstChild;

function rangeBetween(start: Node_, startOffset: number, end: Node_, endOffset: number): Rng {
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  return range as unknown as Rng;
}

describe("selectionToMarkdown", () => {
  it("replaces formulas with their TeX inside one block", () => {
    const r = row();
    expect(selectionToMarkdown(rangeBetween(text("p1"), 0, text("p2"), 6), r, source)).toBe(
      "Area is $x^2$ here.",
    );
  });

  it("copies whole source blocks when the range spans blocks", () => {
    const r = row();
    expect(selectionToMarkdown(rangeBetween(text("title"), 2, text("li"), 3), r, source)).toBe(
      source,
    );
  });

  it("copies only the touched blocks", () => {
    const r = row();
    expect(selectionToMarkdown(rangeBetween(text("title"), 2, text("p2"), 3), r, source)).toBe(
      "# Title\n\nArea is $x^2$ here.",
    );
  });

  it("returns null when the range leaves the row", () => {
    const r = row();
    expect(selectionToMarkdown(rangeBetween(text("outside"), 0, text("p1"), 4), r, source)).toBeNull();
  });

  it("returns null when the range starts in the row and ends outside it", () => {
    const r = row();
    expect(selectionToMarkdown(rangeBetween(text("p1"), 1, text("outside"), 4), r, source)).toBeNull();
  });

  it("returns null for a collapsed range", () => {
    const r = row();
    expect(selectionToMarkdown(rangeBetween(text("p1"), 1, text("p1"), 1), r, source)).toBeNull();
  });

  describe("inside one block", () => {
    const listSource = "- one\n- two $x$\n\nArea $y$ here";
    function blocks(): Row {
      document.body.innerHTML = `
        <div id="row">
          <div data-q5m-lines="0:2"><div id="b1">one</div><div><span id="b2">two </span><span data-q5m-math="$x$"><span id="fx">x</span></span></div></div>
          <div data-q5m-lines="3:4"><span id="a1">Area </span><span data-q5m-math="$y$"><span id="fy">y</span></span><span id="a2"> here</span></div>
        </div>`;
      return document.getElementById("row") as unknown as Row;
    }

    it("returns null for a multi-line block selection without formulas", () => {
      const r = blocks();
      expect(selectionToMarkdown(rangeBetween(text("b1"), 0, text("b2"), 2), r, listSource)).toBeNull();
    });

    it("copies the block's source lines when a multi-line block selection holds a formula", () => {
      const r = blocks();
      expect(selectionToMarkdown(rangeBetween(text("b1"), 0, text("fx"), 1), r, listSource)).toBe(
        "- one\n- two $x$",
      );
    });

    it("replaces a formula the selection starts inside with its whole TeX", () => {
      const r = blocks();
      expect(selectionToMarkdown(rangeBetween(text("fy"), 0, text("a2"), 3), r, listSource)).toBe(
        "$y$ he",
      );
    });

    it("replaces a formula the selection ends inside with its whole TeX", () => {
      const r = blocks();
      expect(selectionToMarkdown(rangeBetween(text("a1"), 0, text("fy"), 1), r, listSource)).toBe(
        "Area $y$",
      );
    });

    it("returns null when the selection sits entirely inside a formula", () => {
      const r = blocks();
      expect(selectionToMarkdown(rangeBetween(text("fy"), 0, text("fy"), 1), r, listSource)).toBeNull();
    });
  });
});
