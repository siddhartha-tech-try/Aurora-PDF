# Architecture

Aurora PDF is organized as a small public facade over specialized backends.

## Public Facade

`AuroraPDF` exposes beginner-friendly static methods:

- `fromDefinition`
- `streamDefinition`
- `fromHtml`
- `fromHtmlFile`
- `fromUrl`
- `fromMarkdown`
- `fromMarkdownFile`
- `fromImage`
- `fromImages`
- `merge`
- `split`
- `compress`
- `optimize`
- `encrypt`
- `setMetadata`
- `watermark`
- `insertLogo`
- `attachFiles`
- `addPageNumbers`
- `batch`

Advanced callers can instantiate `DocumentRenderer`, `HtmlRenderer`, `MarkdownRenderer`, or `PdfModifier` directly.

## Rendering Backends

Structured document definitions use PDFKit. This provides streaming output and direct control over typography, pagination, tables, images, links, headers, footers, and page numbering.

HTML, URL, and Markdown inputs use Playwright. Markdown is converted to HTML first, then rendered through Chromium so CSS, layout, print backgrounds, web fonts, and page media are handled by a browser engine.

Images use Sharp for normalization and PDFKit for page composition. This keeps large image sets predictable and avoids passing unsupported formats directly to PDF encoders.

Existing PDF operations use pdf-lib for merge, split, metadata, attachments, watermarking, logo insertion, and page numbering.

Security uses a separate encryption adapter. The current adapter supports AES-256 and RC4 permission protection through `@pdfsmaller/pdf-encrypt`.

## Extension Points

Plugins can hook into structured rendering:

```ts
const plugin = {
  name: "audit",
  beforeRenderDefinition(definition) {
    return definition;
  },
  afterRenderBytes(bytes) {
    return bytes;
  }
};
```

The adapter boundary is deliberate. Future releases can add a qpdf backend, cloud rendering backend, signature backend, or browser-safe build without changing the main API.

## Tradeoffs

PDF encryption and deep optimization are specialized areas. Aurora PDF keeps them behind adapters so deployments can swap implementations for compliance or platform reasons.

HTML rendering requires Chromium. That is heavier than pure PDF drawing but substantially more reliable for complex CSS, headers, footers, fonts, and web page rendering.

Structured rendering avoids loading the whole page tree into a browser and can stream output, which is better for long programmatic reports.
