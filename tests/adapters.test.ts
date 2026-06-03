import { describe, expect, it } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { AuroraPDF } from "../src/index.js";
import { pageCount, redSquareSvg, startsWithPdfHeader } from "./helpers.js";

describe("input adapters", () => {
  it("renders images and multiple images into PDFs", async () => {
    const single = await AuroraPDF.fromImage(redSquareSvg);
    const multiple = await AuroraPDF.fromImages([redSquareSvg, redSquareSvg], {
      page: {
        size: "LETTER"
      }
    });

    expect(startsWithPdfHeader(single.bytes)).toBe(true);
    await expect(pageCount(single.bytes)).resolves.toBe(1);
    await expect(pageCount(multiple.bytes)).resolves.toBe(2);
  });

  it("renders raw HTML and HTML files using Playwright", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aurora-html-test-"));
    try {
      const file = join(dir, "doc.html");
      await writeFile(
        file,
        `<!doctype html><html><body><h1>HTML File</h1><p>Rendered by Aurora PDF.</p></body></html>`,
        "utf8"
      );

      const raw = await AuroraPDF.fromHtml("<h1>Raw HTML</h1><p>Browser-quality rendering.</p>", {
        waitUntil: "load"
      });
      const fromFile = await AuroraPDF.fromHtmlFile(file, {
        waitUntil: "load"
      });

      expect(startsWithPdfHeader(raw.bytes)).toBe(true);
      expect(startsWithPdfHeader(fromFile.bytes)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("renders Markdown content", async () => {
    const artifact = await AuroraPDF.fromMarkdown(
      `# Markdown Source

Markdown renders through the HTML adapter.

| Column | Value |
| --- | --- |
| status | ready |
`,
      {
        title: "Markdown Test",
        waitUntil: "load"
      }
    );

    expect(startsWithPdfHeader(artifact.bytes)).toBe(true);
  });
});
