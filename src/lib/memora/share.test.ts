import { describe, expect, it } from "vitest";
import { classifyShare, safeNextPath, shareRedirectPath } from "./share";

describe("classifyShare", () => {
  it("treats a single word or a short phrase as a word", () => {
    expect(classifyShare({ text: "reliable" })).toEqual({ kind: "word", value: "reliable" });
    expect(classifyShare({ text: "  “figure out”. " })).toEqual({ kind: "word", value: "figure out" });
    expect(classifyShare({ text: "run into someone" })).toEqual({ kind: "word", value: "run into someone" });
    expect(classifyShare({ text: "address" })).toEqual({ kind: "word", value: "address" });
  });

  it("drops the link Chrome adds to selected text", () => {
    expect(classifyShare({ text: '"thorough"\nhttps://example.com/a#:~:text=thorough' })).toEqual({
      kind: "word",
      value: "thorough",
    });
  });

  it("sends a sentence or a paragraph to From a text", () => {
    const sentence = "My commute takes about forty minutes.";
    expect(classifyShare({ text: sentence })).toEqual({ kind: "text", value: sentence });
    expect(classifyShare({ text: "one two three four five" }).kind).toBe("text");
  });

  it("clamps long texts", () => {
    const result = classifyShare({ text: "word ".repeat(2000) });
    expect(result.kind).toBe("text");
    expect(result.kind === "text" && result.value.length).toBe(3000);
  });

  it("ignores a page title when a link was shared, uses it otherwise", () => {
    expect(classifyShare({ title: "BBC News", url: "https://bbc.com" })).toEqual({ kind: "link" });
    expect(classifyShare({ title: "BBC News", text: "https://bbc.com/x" })).toEqual({ kind: "link" });
    expect(classifyShare({ title: "serendipity" })).toEqual({ kind: "word", value: "serendipity" });
    expect(classifyShare({})).toEqual({ kind: "empty" });
  });
});

describe("shareRedirectPath", () => {
  it("builds the words page URL", () => {
    expect(shareRedirectPath({ kind: "word", value: "figure out" })).toBe("/app/words?add=figure+out");
    expect(shareRedirectPath({ kind: "text", value: "A b." })).toBe("/app/words?text=A+b.");
    expect(shareRedirectPath({ kind: "link" })).toBe("/app/words?shared=link");
    expect(shareRedirectPath({ kind: "empty" })).toBe("/app/words");
  });
});

describe("safeNextPath", () => {
  it("allows only app pages", () => {
    expect(safeNextPath("/app/share?text=hi")).toBe("/app/share?text=hi");
    expect(safeNextPath("//evil.com/app")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("/beta")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
