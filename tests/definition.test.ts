import { describe, expect, it } from "vitest";
import { AuroraPDF, type AuroraPdfPlugin } from "../src/index.js";
import { pageCount, sampleDefinition, startsWithPdfHeader } from "./helpers.js";

describe("structured document generation", () => {
  it("renders document definitions with templates, components, tables, images, headers, and page numbers", async () => {
    const artifact = await AuroraPDF.fromDefinition(sampleDefinition(), {
      data: {
        title: "Generated From a Template"
      }
    });

    expect(startsWithPdfHeader(artifact.bytes)).toBe(true);
    expect(artifact.byteLength).toBeGreaterThan(2_000);
    await expect(pageCount(artifact.bytes)).resolves.toBe(1);
  });

  it("supports plugin hooks around rendering", async () => {
    const plugin: AuroraPdfPlugin = {
      name: "test-title-prefix",
      beforeRenderDefinition(definition) {
        return {
          ...definition,
          content: [{ type: "heading", text: "Plugin Prefix", level: 2 }, ...definition.content]
        };
      },
      afterRenderBytes(bytes) {
        expect(bytes.byteLength).toBeGreaterThan(1000);
        return bytes;
      }
    };

    const artifact = await AuroraPDF.fromDefinition(sampleDefinition(), {
      data: { title: "Plugin Test" },
      plugins: [plugin]
    });

    expect(startsWithPdfHeader(artifact.bytes)).toBe(true);
  });

  it("streams structured output for memory-sensitive callers", async () => {
    const result = await AuroraPDF.streamDefinition(sampleDefinition(), {
      data: {
        title: "Streamed"
      }
    });

    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const streamed = Buffer.concat(chunks);
    const collected = await result.done;
    expect(streamed.byteLength).toBe(collected.byteLength);
    expect(startsWithPdfHeader(collected)).toBe(true);
  });

  it("renders table-heavy documents without internal stream backpressure", async () => {
    const rows = Array.from({ length: 300 }, (_, index) => [`Row ${index + 1}`, `Value ${index + 1}`, "ready"]);
    const artifact = await AuroraPDF.fromDefinition({
      page: { margin: 42 },
      pageNumbers: { enabled: true },
      content: [
        { type: "heading", text: "Large Table", level: 1 },
        {
          type: "table",
          headers: ["Name", "Value", "Status"],
          rows
        }
      ]
    });

    expect(startsWithPdfHeader(artifact.bytes)).toBe(true);
    expect(await artifact.pageCount()).toBeGreaterThan(1);
  });
});
