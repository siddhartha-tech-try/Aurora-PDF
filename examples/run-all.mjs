import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AuroraPDF } from "../dist/index.js";

const samplesDir = fileURLToPath(new URL("../samples/", import.meta.url));
await mkdir(samplesDir, { recursive: true });

const image =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
      <rect width="720" height="420" fill="#f8fafc"/>
      <rect x="48" y="48" width="624" height="324" rx="18" fill="#2563eb"/>
      <circle cx="220" cy="210" r="88" fill="#f97316"/>
      <rect x="340" y="140" width="240" height="32" fill="#ffffff"/>
      <rect x="340" y="198" width="180" height="32" fill="#dbeafe"/>
      <rect x="340" y="256" width="220" height="32" fill="#bfdbfe"/>
    </svg>`
  ).toString("base64");

const definition = {
  metadata: {
    title: "Aurora PDF Structured Example",
    author: "Aurora PDF"
  },
  page: {
    size: "A4",
    margin: 48
  },
  theme: {
    primaryColor: "#2563eb",
    tableHeaderFill: "#dbeafe",
    tableStripeFill: "#f8fafc"
  },
  header: {
    text: "Aurora PDF Example",
    align: "left"
  },
  footer: {
    text: "Generated with Aurora PDF"
  },
  pageNumbers: {
    enabled: true,
    format: "page-of-total"
  },
  components: {
    callout: {
      content: [
        {
          type: "paragraph",
          text: "{{label}}: {{value}}",
          fontSize: 12
        }
      ]
    }
  },
  content: [
    {
      type: "heading",
      text: "{{title}}",
      level: 1,
      bookmark: "Overview"
    },
    {
      type: "paragraph",
      text: "This sample exercises structured rendering, reusable components, image embedding, tables, metadata, header and footer rendering, and page numbering."
    },
    {
      type: "component",
      name: "callout",
      props: {
        label: "Runtime",
        value: "Node.js TypeScript library"
      }
    },
    {
      type: "image",
      src: image,
      width: 360,
      align: "center"
    },
    {
      type: "table",
      headers: ["Input", "Backend", "Use case"],
      rows: [
        ["Document definition", "PDFKit", "programmatic reports"],
        ["HTML and URL", "Playwright", "browser-accurate layouts"],
        ["Existing PDFs", "pdf-lib", "merge, split, metadata, watermarking"],
        ["Security", "AES-256 adapter", "password and permission protection"]
      ]
    }
  ]
};

const structured = await AuroraPDF.fromDefinition(definition, {
  data: {
    title: "Production PDF Generation"
  }
});
await structured.save(join(samplesDir, "structured.pdf"));

const markdown = await AuroraPDF.fromMarkdown(
  `# Markdown Report

Aurora PDF can render Markdown through the same browser-quality path used by HTML.

| Area | Status |
| --- | --- |
| Tables | Supported |
| Links | Supported |
| Print CSS | Supported |
`,
  {
    title: "Markdown Report",
    waitUntil: "load",
    footer: {
      text: "Markdown sample"
    },
    pageNumbers: {
      enabled: true
    }
  }
);
await markdown.save(join(samplesDir, "markdown.pdf"));

const html = await AuroraPDF.fromHtml(
  `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #172554; }
        h1 { color: #2563eb; }
        .panel { border: 1px solid #bfdbfe; padding: 18px; border-radius: 6px; }
      </style>
    </head>
    <body>
      <h1>HTML Rendering</h1>
      <div class="panel">This PDF was rendered from HTML with print background support.</div>
    </body>
  </html>`,
  {
    waitUntil: "load",
    footer: {
      text: "HTML sample"
    },
    pageNumbers: {
      enabled: true
    }
  }
);
await html.save(join(samplesDir, "html.pdf"));

const images = await AuroraPDF.fromImages([image, image], {
  fit: "contain",
  metadata: {
    title: "Image Set"
  }
});
await images.save(join(samplesDir, "image-set.pdf"));

const merged = await AuroraPDF.merge([structured.bytes, markdown.bytes, html.bytes], {
  metadata: {
    title: "Merged Aurora Samples"
  }
});
await merged.save(join(samplesDir, "merged.pdf"));

const watermarked = await AuroraPDF.watermark(merged.bytes, {
  text: "SAMPLE",
  opacity: 0.16
});
await watermarked.save(join(samplesDir, "watermarked.pdf"));

const encrypted = await AuroraPDF.encrypt(watermarked.bytes, {
  userPassword: "aurora-user",
  ownerPassword: "aurora-owner",
  permissions: {
    copying: false,
    modifying: false,
    printing: true
  }
});
await encrypted.save(join(samplesDir, "encrypted.pdf"));

const splitDir = join(samplesDir, "split");
await rm(splitDir, { recursive: true, force: true });
await mkdir(splitDir, { recursive: true });
const split = await AuroraPDF.split(merged.bytes, {
  ranges: [{ from: 1, to: 1 }]
});
await split[0].save(join(splitDir, "page-1.pdf"));

console.log("Generated sample PDFs in samples/");
