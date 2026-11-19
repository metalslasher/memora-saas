import { describe, expect, it } from "vitest";
import { parseWordsCsv } from "./csv-import";
import { wordsToCsv } from "./export";

describe("wordsToCsv", () => {
  it("exports words in the import format", () => {
    const csv = wordsToCsv([
      {
        lemma: "figure out",
        content: { translations: ["розібратися", "зрозуміти"], part_of_speech: "phrasal verb", examples: [{ en: 'Say "hi".' }] },
        source: "manual",
        status: "active",
      },
    ]);
    expect(csv.split("\n")[0]).toBe("lemma_en,translation_uk,part_of_speech,example_en,source,status");
    expect(csv.split("\n")[1]).toBe('figure out,"розібратися, зрозуміти",phrasal verb,"Say ""hi"".",manual,active');
    expect(parseWordsCsv(csv, new Set()).rows[0].draft?.translation).toBe("розібратися, зрозуміти");
  });
});
