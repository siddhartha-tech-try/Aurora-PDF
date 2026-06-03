import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { AuroraPDF } from "../src/index.js";
import { pageCount, redSquareSvg, sampleDefinition, startsWithPdfHeader } from "./helpers.js";

describe("PDF modification operations", () => {
  it("merges and splits PDFs", async () => {
    const first = await AuroraPDF.fromDefinition(sampleDefinition(), { data: { title: "First" } });
    const second = await AuroraPDF.fromDefinition(sampleDefinition(), { data: { title: "Second" } });

    const merged = await AuroraPDF.merge([first.bytes, second.bytes], {
      metadata: {
        title: "Merged"
      }
    });

    expect(startsWithPdfHeader(merged.bytes)).toBe(true);
    await expect(pageCount(merged.bytes)).resolves.toBe(2);

    const pages = await AuroraPDF.split(merged.bytes);
    expect(pages).toHaveLength(2);
    await expect(pageCount(pages[0]!.bytes)).resolves.toBe(1);
  });

  it("edits metadata, adds watermarks, logos, attachments, and page numbers", async () => {
    const source = await AuroraPDF.fromDefinition(sampleDefinition(), { data: { title: "Modify Me" } });
    const withMetadata = await AuroraPDF.setMetadata(source.bytes, {
      title: "Modified Metadata",
      author: "Test Suite",
      keywords: ["aurora", "pdf"]
    });
    const withWatermark = await AuroraPDF.watermark(withMetadata.bytes, {
      text: "DRAFT",
      opacity: 0.2
    });
    const withLogo = await AuroraPDF.insertLogo(withWatermark.bytes, {
      image: redSquareSvg,
      width: 48
    });
    const withAttachment = await AuroraPDF.attachFiles(withLogo.bytes, [
      {
        name: "note.txt",
        data: Buffer.from("Attached by Aurora PDF", "utf8"),
        mimeType: "text/plain"
      }
    ]);
    const numbered = await AuroraPDF.addPageNumbers(withAttachment.bytes);

    const loaded = await PDFDocument.load(numbered.bytes, { ignoreEncryption: true });
    expect(loaded.getTitle()).toBe("Modified Metadata");
    expect(loaded.getAuthor()).toBe("Test Suite");
    expect(startsWithPdfHeader(numbered.bytes)).toBe(true);
  });

  it("optimizes, compresses, and encrypts PDFs", async () => {
    const source = await AuroraPDF.fromDefinition(sampleDefinition(), { data: { title: "Secure" } });
    const optimized = await AuroraPDF.optimize(source.bytes, { useObjectStreams: true });
    const compressed = await AuroraPDF.compress(optimized.bytes);
    const encrypted = await AuroraPDF.encrypt(compressed.bytes, {
      userPassword: "user-pass",
      ownerPassword: "owner-pass",
      permissions: {
        copying: false,
        modifying: false,
        printing: true
      }
    });

    const text = Buffer.from(encrypted.bytes).toString("latin1");
    expect(startsWithPdfHeader(encrypted.bytes)).toBe(true);
    expect(text).toContain("/Encrypt");
  });
});
