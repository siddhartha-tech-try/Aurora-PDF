# Aurora PDF

Aurora PDF is a TypeScript library for generating and modifying PDFs from HTML, URLs, Markdown, images, structured document definitions, and existing PDF files.

It is designed as an embeddable production library for Node.js services, CLIs, desktop apps, and application backends that need a single PDF API with multiple rendering backends.

## Capabilities

- Generate PDFs from raw HTML, HTML files, URLs, Markdown, images, image sets, and structured document definitions.
- Modify existing PDFs with merge, split, metadata edits, page numbering, watermarks, logos, and attachments.
- Protect PDFs with user and owner passwords plus granular permissions.
- Render A4, Letter, Legal, custom page sizes, portrait, landscape, margins, bleed metadata, DPI-aware image normalization, and print-ready browser output.
- Use templates, themes, reusable components, data binding, plugins, batch generation, and streaming structured generation.
- Run as a library or CLI.

## Install

```bash
npm install aurora-pdf
npx playwright install chromium
```

The Chromium install is required for HTML, URL, and Markdown rendering. Structured documents, image PDFs, and PDF modification do not need Chromium.

## Quick Start

```ts
import { AuroraPDF } from "aurora-pdf";

const pdf = await AuroraPDF.fromDefinition(
  {
    metadata: { title: "Invoice" },
    page: { size: "A4", margin: 48 },
    pageNumbers: { enabled: true },
    content: [
      { type: "heading", text: "Invoice {{number}}", level: 1 },
      { type: "paragraph", text: "Prepared for {{customer}}" },
      {
        type: "table",
        headers: ["Item", "Qty", "Price"],
        rows: [
          ["Design", 1, "$800"],
          ["Development", 2, "$2,400"]
        ]
      }
    ]
  },
  {
    data: {
      number: "A-1001",
      customer: "Acme Corp"
    }
  }
);

await pdf.save("invoice.pdf");
```

## HTML, Markdown, Images, and Existing PDFs

```ts
await AuroraPDF.fromHtml("<h1>Report</h1>").then((pdf) => pdf.save("html.pdf"));
await AuroraPDF.fromUrl("https://example.com").then((pdf) => pdf.save("page.pdf"));
await AuroraPDF.fromMarkdown("# Report\n\nMarkdown source.").then((pdf) => pdf.save("markdown.pdf"));
await AuroraPDF.fromImages(["photo-1.jpg", "photo-2.png"]).then((pdf) => pdf.save("album.pdf"));

const merged = await AuroraPDF.merge(["a.pdf", "b.pdf"]);
const protectedPdf = await AuroraPDF.encrypt(merged.bytes, {
  userPassword: "open",
  ownerPassword: "admin",
  permissions: { copying: false, modifying: false }
});
await protectedPdf.save("protected.pdf");
```

## CLI

```bash
aurora-pdf markdown README.md readme.pdf
aurora-pdf html ./page.html page.pdf
aurora-pdf merge merged.pdf one.pdf two.pdf
aurora-pdf encrypt merged.pdf protected.pdf --user-password open --owner-password admin --no-copying
```

## Repository Layout

- `src/core`: public types, structured renderer, template engine, themes, plugins, validation, artifacts.
- `src/adapters`: HTML, Markdown, image normalization, PDF modification.
- `src/security`: encryption and permission protection.
- `tests`: unit and integration tests.
- `examples`: scripts that generate real PDFs in `samples`.
- `benchmarks`: repeatable performance checks.
- `docs`: architecture, API reference, security, performance, release notes.


## Verification

```bash
npm run verify
```

This builds ESM and CJS bundles, generates declarations, runs tests, creates sample PDFs, runs the large-document benchmark, and builds typed API docs.

## Design Rationale

Aurora PDF uses specialized engines instead of one universal renderer:

- PDFKit for structured and streaming generation.
- Playwright for browser-accurate HTML, URL, and Markdown rendering.
- pdf-lib for existing PDF modification.
- Sharp for reliable image normalization.
- A dedicated encryption adapter for password and permission protection.

This architecture favors performance, reliability, and maintainability over a simplistic single-backend design.
