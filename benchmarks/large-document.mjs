import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AuroraPDF } from "../dist/index.js";

const samplesDir = fileURLToPath(new URL("../samples/", import.meta.url));
await mkdir(samplesDir, { recursive: true });

const rows = Array.from({ length: 600 }, (_, index) => [
  `INV-${String(index + 1).padStart(5, "0")}`,
  `Customer ${index + 1}`,
  `$${(125 + index * 3.17).toFixed(2)}`
]);

const definition = {
  metadata: {
    title: "Aurora PDF Large Document Benchmark"
  },
  page: {
    size: "A4",
    margin: 42
  },
  header: {
    text: "Large document benchmark",
    align: "left"
  },
  pageNumbers: {
    enabled: true,
    format: "page-of-total"
  },
  content: [
    {
      type: "heading",
      text: "Large Document Benchmark",
      level: 1
    },
    {
      type: "paragraph",
      text: "This benchmark generates a multi-page table-heavy PDF to measure wall-clock time, output size, and memory growth."
    },
    {
      type: "table",
      headers: ["Invoice", "Customer", "Amount"],
      rows
    }
  ]
};

const memoryBefore = process.memoryUsage().heapUsed;
const start = performance.now();
const artifact = await AuroraPDF.fromDefinition(definition, {
  optimize: {
    useObjectStreams: true
  }
});
const durationMs = performance.now() - start;
const memoryAfter = process.memoryUsage().heapUsed;
const pageCount = await artifact.pageCount();
await artifact.save(join(samplesDir, "benchmark-large.pdf"));

const report = {
  generatedAt: new Date().toISOString(),
  pages: pageCount,
  bytes: artifact.byteLength,
  durationMs: Number(durationMs.toFixed(2)),
  heapDeltaMb: Number(((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2))
};

await writeFile(join(samplesDir, "benchmark-large.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
