# Aurora PDF Knowledge Transfer Guide

This document is a complete KT guide for a new developer joining Aurora PDF.

It explains:

- What the project does.
- How the architecture is organized.
- Why the architecture was chosen.
- What every source file is responsible for.
- How the main methods work.
- How data moves through the system.
- How tests, examples, benchmarks, docs, and release flow work.
- How to safely extend or debug the project.

The goal is that a beginner or fresher developer can read this document and understand the complete codebase well enough to maintain it.

## 1. Product Summary

Aurora PDF is a reusable PDF generation and modification library written in TypeScript.

It can generate PDFs from:

- Raw HTML.
- HTML files.
- URLs and web pages.
- Markdown strings.
- Markdown files.
- Single images.
- Multiple images.
- Structured document definitions.
- Programmatic content.
- Existing PDFs that need modification.

It can modify PDFs by:

- Merging.
- Splitting.
- Optimizing.
- Compressing.
- Editing metadata.
- Adding watermarks.
- Inserting logos.
- Adding page numbers.
- Attaching files.
- Encrypting and password protecting.
- Applying permissions.

## 2. High-Level Architecture

Aurora PDF does not use one engine for everything.

Instead, it uses specialized engines:

```text
Caller
  |
  v
AuroraPDF public facade
  |
  +--> DocumentRenderer  -> PDFKit     -> structured PDFs
  +--> HtmlRenderer      -> Playwright -> HTML, files, URLs
  +--> MarkdownRenderer  -> MarkdownIt -> HTML -> Playwright
  +--> imagesToPdf       -> Sharp      -> PDFKit
  +--> PdfModifier       -> pdf-lib    -> existing PDF operations
  +--> encryptPdf        -> @pdfsmaller/pdf-encrypt
```

This is the most important architectural idea in the project.

PDF work is broad. Browser rendering, programmatic drawing, binary PDF modification, image normalization, and encryption are different problems. A single backend would either be too weak or too complex.

## 3. Architectural Decisions

### Decision: TypeScript

Reason:

- Strong public API typing.
- Safer document definitions.
- Better beginner developer experience through autocomplete.
- Easier package publishing to Node applications.

Tradeoff:

- Build step is required.

### Decision: Static Facade API

The main public class is `AuroraPDF`.

Example:

```ts
const pdf = await AuroraPDF.fromMarkdown("# Report");
```

Reason:

- Simple for beginners.
- No setup object required for common usage.
- Advanced developers can still instantiate lower-level classes directly.

Tradeoff:

- Shared renderer instances are static. If future renderers need stateful configuration, a builder or instance API may be added.

### Decision: PDFKit for Structured Rendering

Structured documents use `pdfkit`.

Reason:

- Good programmatic drawing support.
- Streaming output support.
- Direct control over text, tables, images, headers, footers, page numbers, and layout.

Tradeoff:

- It does not understand HTML/CSS.
- Custom layout behavior must be implemented manually.

### Decision: Playwright for HTML, URLs, and Markdown

HTML and URLs render through Chromium using Playwright.

Markdown first converts to HTML, then uses the HTML renderer.

Reason:

- Browser-quality CSS and layout.
- Supports real web pages.
- Supports print media rendering.

Tradeoff:

- Chromium must be installed.
- Browser startup is heavier than structured PDF drawing.

### Decision: pdf-lib for Existing PDF Modification

Existing PDFs are modified through `pdf-lib`.

Reason:

- Good pure JavaScript API for loading and manipulating PDF bytes.
- Supports page copying, metadata, drawing text/images, attachments, and saving.

Tradeoff:

- Some advanced optimization features are limited compared to qpdf or Ghostscript.

### Decision: Sharp for Images

Images are normalized with `sharp`.

Reason:

- Handles many image formats.
- Can resize and recompress.
- Can preserve alpha as PNG or output JPEG for non-alpha images.

Tradeoff:

- Native/platform package; install can be more sensitive on locked-down machines.

### Decision: Encryption Adapter

Encryption is isolated in `src/security/encryption.ts`.

Reason:

- Security backends may change.
- Some deployments may require qpdf, HSM-backed services, or compliance-specific libraries.
- Public API can remain stable even if backend changes.

Tradeoff:

- Current metadata protection behavior is limited by the adapter.

### Decision: `PdfArtifact` Return Object

Most methods return `PdfArtifact`, not raw bytes.

Reason:

- It keeps byte data plus useful helper methods.
- Callers can save, stream, inspect byte length, or get page count.

Tradeoff:

- A tiny wrapper object is created for each output.

## 4. Repository Structure

```text
aurora-pdf/
  src/
    adapters/
    cli/
    core/
    security/
    utils/
    api.ts
    errors.ts
    index.ts
    types.ts
  tests/
  examples/
  benchmarks/
  docs/
  samples/
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  typedoc.json
```

## 5. Public Entry Point

### `src/index.ts`

This file re-exports the public API.

It exports:

- `AuroraPDF`
- `PdfArtifact`
- `DocumentRenderer`
- `HtmlRenderer`
- `MarkdownRenderer`
- `PdfModifier`
- `encryptPdf`
- selected utility helpers
- all public types
- all public errors

Why it exists:

- npm package consumers import from the package root.
- The package export points to built versions of this file.

Example:

```ts
import { AuroraPDF, type DocumentDefinition } from "aurora-pdf";
```

## 6. Public Facade

### `src/api.ts`

This file contains the `AuroraPDF` class.

`AuroraPDF` is a facade. A facade is a simple front door over multiple internal systems.

It owns static renderer instances:

```ts
private static readonly documentRenderer = new DocumentRenderer();
private static readonly htmlRenderer = new HtmlRenderer();
private static readonly markdownRenderer = new MarkdownRenderer(AuroraPDF.htmlRenderer);
private static readonly modifier = new PdfModifier();
```

Why static instances:

- Simple usage.
- Avoids repeatedly constructing lightweight renderer objects.
- Keeps public calls short.

### Generation Methods

#### `fromDefinition(definition, options)`

Uses:

- `DocumentRenderer.render`

Purpose:

- Generate a PDF from a structured `DocumentDefinition`.

Flow:

```text
AuroraPDF.fromDefinition
  -> DocumentRenderer.render
  -> renderToStream
  -> PDFKit draws blocks
  -> optional attachments
  -> optional optimization
  -> optional encryption
  -> plugin afterRenderBytes
  -> PdfArtifact
```

#### `streamDefinition(definition, options)`

Uses:

- `DocumentRenderer.renderToStream`

Purpose:

- Return a stream for memory-sensitive structured generation.

Return shape:

```ts
{
  stream: Readable;
  done: Promise<Uint8Array>;
}
```

Important:

- The caller must consume `stream`.
- The `done` promise resolves when PDFKit finishes generating bytes.

#### `fromHtml(html, options)`

Uses:

- `HtmlRenderer.fromHtml`

Purpose:

- Render raw HTML string into PDF.

Backend:

- Playwright Chromium.

#### `fromHtmlFile(path, options)`

Uses:

- `HtmlRenderer.fromHtmlFile`

Purpose:

- Render a local HTML file into PDF.

Backend:

- Playwright Chromium.

#### `fromUrl(url, options)`

Uses:

- `HtmlRenderer.fromUrl`

Purpose:

- Render a web page into PDF.

Backend:

- Playwright Chromium.

#### `fromMarkdown(markdown, options)`

Uses:

- `MarkdownRenderer.fromMarkdown`

Purpose:

- Convert Markdown to HTML, then render PDF.

Backend:

- MarkdownIt.
- HtmlRenderer.
- Playwright Chromium.

#### `fromMarkdownFile(path, options)`

Uses:

- `MarkdownRenderer.fromMarkdownFile`

Purpose:

- Read a Markdown file and render it to PDF.

#### `fromImage(image, options)`

Uses:

- `imagesToPdf([image], options)`

Purpose:

- Convert one image into a one-page PDF.

#### `fromImages(images, options)`

Uses:

- `imagesToPdf(images, options)`

Purpose:

- Convert multiple images into one PDF with one page per image.

#### `fromExistingPdf(path)`

Purpose:

- Load a PDF from disk into a `PdfArtifact`.

This method does not modify the PDF.

### Modification Methods

These delegate to `PdfModifier`:

- `merge`
- `split`
- `compress`
- `optimize`
- `setMetadata`
- `watermark`
- `insertLogo`
- `attachFiles`
- `addPageNumbers`

### Security Methods

#### `encrypt(input, options)`

Uses:

- `encryptPdf`

Purpose:

- Password protect and apply permissions.

#### `protect(input, options)`

Alias for:

```ts
this.encrypt(input, options)
```

It exists because some users search for "protect PDF" instead of "encrypt PDF".

### Batch Method

#### `batch(jobs, options)`

Purpose:

- Generate multiple PDFs with controlled concurrency.

Inputs:

```ts
{
  kind: "html" | "url" | "markdown" | "definition" | "image" | "images";
  input: unknown;
  options?: unknown;
  outputPath?: string;
}
```

Flow:

```text
batch
  -> set concurrency default to 2
  -> create result array
  -> start worker functions
  -> each worker takes next job
  -> runBatchJob delegates by kind
  -> save if outputPath exists
  -> return artifacts in input order
```

Important:

- Results preserve job order.
- Concurrency defaults to `2` to avoid launching too many browser/image tasks.

## 7. Type Contracts

### `src/types.ts`

This is the public type contract file.

A beginner should understand that most of the library is controlled by these interfaces.

### Core Input Types

#### `PdfByteSource`

```ts
Uint8Array | ArrayBuffer | Buffer | string
```

Used for existing PDF inputs.

If it is a string, it can be:

- file path
- URL
- data URI

#### `BinaryInput`

```ts
Uint8Array | ArrayBuffer | Buffer | string | URL
```

Used for images and attachments.

### Page Types

#### `PagePreset`

Allowed preset page sizes:

- `A4`
- `LETTER`
- `LEGAL`

#### `PageSize`

Can be:

- preset string
- custom `[width, height]` tuple in PDF points

One inch equals 72 PDF points.

#### `PageSetup`

Controls:

- page size
- orientation
- margin
- bleed
- dpi
- print-ready flag

### Metadata

#### `PdfMetadata`

Controls:

- title
- author
- subject
- keywords
- creator
- producer
- creation date
- modification date
- language

### Theme

#### `Theme`

Controls default visual style for structured and Markdown output:

- fonts
- text color
- muted color
- primary color
- border color
- table fill colors
- background color

### Header, Footer, Page Numbers

#### `HeaderFooterDefinition`

Supports:

- text
- HTML template for Playwright path
- height
- alignment
- font size
- color
- show or hide on first page

#### `PageNumberingOptions`

Supports:

- enabled flag
- `page`
- `page-of-total`
- alignment
- font size
- color
- custom starting page number

### Content Blocks

Structured documents use a discriminated union called `ContentBlock`.

Every block has a `type` field.

Supported block types:

- `text`
- `heading`
- `paragraph`
- `image`
- `table`
- `list`
- `columns`
- `spacer`
- `pageBreak`
- `component`

This is how the renderer knows which drawing method to call.

### Document Definition

#### `DocumentDefinition`

Top-level structured document object.

It can include:

- page setup
- metadata
- theme
- fonts
- header
- footer
- page numbers
- reusable components
- attachments
- content blocks

Only `content` is required.

### Render Options

#### `RenderOptions`

Extends template options and adds:

- plugins
- optimize
- encryption

This means a structured PDF can be templated, rendered, optimized, encrypted, and passed through plugins in one call.

### HTML and Markdown Options

#### `HtmlRenderOptions`

Controls:

- page
- metadata
- header
- footer
- page numbers
- print background
- wait strategy
- timeout
- print or screen media
- base URL
- extra CSS

#### `MarkdownRenderOptions`

Extends HTML options and adds:

- title
- theme

### Image Options

#### `ImagePdfOptions`

Controls:

- page
- metadata
- contain or cover fit
- background color
- image quality

### Modification Options

Important options:

- `MergeOptions`
- `SplitOptions`
- `OptimizeOptions`
- `CompressionOptions`
- `WatermarkOptions`
- `LogoOptions`
- `AttachmentDefinition`

### Encryption Options

#### `EncryptOptions`

Requires:

- `userPassword`

Optional:

- owner password
- algorithm
- permissions
- metadata protection flag

Supported algorithm values:

- `AES-256`
- `RC4`

Use `AES-256` unless legacy reader compatibility requires RC4.

### Plugin Type

#### `AuroraPdfPlugin`

Plugin hooks:

- `beforeRenderDefinition`
- `afterRenderBytes`

Plugins currently apply to structured definition rendering.

## 8. Structured Rendering Internals

### `src/core/renderer.ts`

This is the largest and most important source file.

It contains `DocumentRenderer`, which converts a `DocumentDefinition` into PDF bytes using PDFKit.

### Important Internal Type: `RenderState`

`RenderState` stores values needed while drawing:

- `doc`: the PDFKit document.
- `theme`: merged theme with defaults.
- `definition`: final document definition.
- `pageWidth`: resolved page width.
- `pageHeight`: resolved page height.
- `contentWidth`: page width minus left and right margins.
- `components`: reusable component definitions.

### `render(definition, options)`

This is the high-level structured rendering method.

Steps:

1. Calls `renderToStream`.
2. Drains the stream with `streamResult.stream.resume()`.
3. Waits for all generated bytes.
4. Adds attachments if the definition has attachments.
5. Optimizes if `options.optimize` exists.
6. Encrypts if `options.encryption` exists.
7. Runs `afterRenderBytes` plugins.
8. Returns a `PdfArtifact`.

Why `stream.resume()` matters:

- PDFKit writes to a stream.
- If nobody reads the stream, large documents can hit backpressure.
- `render()` is for callers who want bytes, so the library drains the stream internally.
- `streamDefinition()` is for callers who want to consume the stream themselves.

### `renderToStream(definition, options)`

This creates the actual PDFKit document.

Steps:

1. Applies Handlebars template data to the definition.
2. Runs `beforeRenderDefinition` plugins.
3. Validates the definition.
4. Normalizes page setup.
5. Resolves page width and height.
6. Merges the theme with defaults.
7. Creates a PDFKit document with `autoFirstPage: false`.
8. Registers custom fonts.
9. Creates a `PassThrough` stream.
10. Collects emitted chunks into an array.
11. Pipes the PDFKit document into the stream.
12. Creates the render state.
13. Adds the first page.
14. Renders all content blocks.
15. Renders headers, footers, and page numbers.
16. Ends the PDFKit document.
17. Returns `{ stream, done }`.

### `registerFonts(doc, definition)`

Loops over `definition.fonts`.

For each font:

- registers normal font
- registers bold font if provided
- registers italic font if provided
- registers bold italic font if provided

Font naming convention:

```text
FontName
FontName-Bold
FontName-Italic
FontName-BoldItalic
```

### `renderBlocks(blocks, state)`

Loops through content blocks in order.

For each block:

1. Applies `marginTop`.
2. Adds bookmark if `bookmark` is set.
3. Calls `renderBlock`.
4. Applies `marginBottom`.

### `renderBlock(block, state)`

Switches on `block.type`.

Dispatch table:

```text
heading   -> renderHeading
text      -> renderText
paragraph -> renderText
image     -> renderImage
table     -> renderTable
list      -> renderList
columns   -> renderColumns
spacer    -> move y position
pageBreak -> add page
component -> renderComponent
```

The `assertNever` fallback protects against unsupported block types.

### `renderHeading(block, state)`

Draws heading text.

Important behavior:

- Uses heading level to choose font size.
- Uses `headingFontFamily`.
- Uses primary color by default.
- Calls `ensureSpace` before drawing.
- Adds spacing after heading.

### `renderText(block, state)`

Draws both `text` and `paragraph` blocks.

Important behavior:

- Text blocks can be bold and have custom width.
- Paragraph blocks use full content width.
- Links are passed to PDFKit.
- Link text is underlined automatically.
- Paragraph blocks add spacing after text.

### `renderImage(block, state)`

Draws an image block.

Steps:

1. Calls `normalizeImage`.
2. Calculates max width and height.
3. Preserves aspect ratio.
4. Calls `ensureSpace`.
5. Aligns left, center, or right.
6. Draws image using PDFKit.
7. Moves the PDF cursor below the image.

### `renderTable(block, state)`

Draws a table.

Steps:

1. Computes table width.
2. Computes column count.
3. Uses provided column widths or equal widths.
4. Builds rows, including headers if present.
5. For each row, calculates row height based on cell text.
6. Ensures enough page space.
7. Draws cell background and border.
8. Draws cell text.
9. Moves cursor to next row.

Important details:

- Header row is bold by default.
- Stripe fill is enabled by default.
- Cell values are normalized through `normalizeCell`.
- `doc.heightOfString` is used to estimate row height.

### `renderList(block, state)`

Draws ordered or unordered lists.

Important behavior:

- Ordered list marker is `1.`, `2.`, etc.
- Unordered list marker is a bullet-like marker.
- Marker uses a fixed 28 point width.
- Item text uses remaining content width.

### `renderColumns(block, state)`

Draws multiple columns.

Steps:

1. Calculates available width.
2. Calculates column widths.
3. Saves starting x and y positions.
4. Renders each column from the same y start.
5. Tracks the maximum y reached.
6. Restores content width.
7. Moves cursor below the tallest column.

Important:

- This is a simple column layout.
- It does not yet rebalance columns across pages.

### `renderComponent(name, props, state)`

Renders reusable components.

Steps:

1. Looks up `state.components[name]`.
2. Throws `InvalidDocumentError` if missing.
3. Stringifies component content.
4. Applies Handlebars rendering with `props`.
5. Parses rendered JSON back to content blocks.
6. Calls `renderBlocks`.

### `renderHeadersFooters(state)`

Adds headers, footers, and page numbers after content is rendered.

Why after content:

- The total page count is known only after all content is rendered.
- PDFKit `bufferPages: true` lets us switch back to each page.

Flow:

```text
get buffered page range
for each page:
  switch to page
  render header
  render footer
  render page number if enabled
```

### `renderHeaderFooterText`

Draws header or footer text.

Important behavior:

- Supports `{{page}}` and `{{total}}`.
- Can hide first page with `showOnFirstPage: false`.
- Uses safe y positions so headers/footers do not create unexpected extra pages.
- Uses `lineBreak: false`.

### `renderPageNumber`

Draws page number text.

Important behavior:

- Supports `page`.
- Supports `page-of-total`.
- Supports custom `startAt`.
- Uses configured alignment.
- Draws inside safe bottom margin.

### `ensureSpace(doc, needed)`

Checks if there is enough vertical space left on the current page.

If not, adds a new page.

This function is central to pagination.

### Helper Functions

#### `normalizeCell`

Turns simple values into `TableCell` objects.

#### `lineHeight`

Returns:

```ts
theme.fontSize + theme.lineGap
```

#### `alignX`

Calculates image x position for left, center, and right alignment.

#### `interpolatePageTokens`

Replaces:

- `{{page}}`
- `{{total}}`

#### `assertNever`

Throws if the TypeScript union dispatch receives an unsupported block.

## 9. Artifact Model

### `src/core/artifact.ts`

`PdfArtifact` wraps generated PDF bytes.

Constructor:

```ts
new PdfArtifact(bytes, source)
```

Fields:

- `bytes`
- `source`

Methods:

#### `byteLength`

Returns byte size.

#### `toBuffer()`

Converts internal bytes to a Node `Buffer`.

#### `toUint8Array()`

Returns internal `Uint8Array`.

#### `stream()`

Creates a readable stream from bytes.

#### `save(path)`

Writes bytes to disk using secure file mode.

#### `pageCount()`

Loads bytes with `pdf-lib` and returns page count.

## 10. Template System

### `src/core/template.ts`

Uses Handlebars.

### `renderDefinition(definition, options)`

If `options.data` is missing, returns the definition unchanged.

If data exists:

1. Stringifies the definition.
2. Compiles it as a Handlebars template.
3. Renders it with data.
4. Parses JSON back into a `DocumentDefinition`.

Example:

```ts
{ type: "heading", text: "Invoice {{number}}" }
```

with:

```ts
{ number: "INV-100" }
```

becomes:

```ts
{ type: "heading", text: "Invoice INV-100" }
```

### `renderString(source, data, strict)`

Renders a plain string with Handlebars.

Used by components.

## 11. Plugin System

### `src/core/plugins.ts`

Plugins are run in order.

### `applyBeforeDefinitionPlugins`

Each plugin can modify the document definition before rendering.

Example use:

- Add legal footer.
- Inject tracking metadata.
- Add organization branding.

### `applyAfterBytesPlugins`

Each plugin can modify or inspect bytes after rendering.

Example use:

- Upload to storage.
- Run extra optimization.
- Add audit hash.

## 12. Theme System

### `src/core/theme.ts`

Defines `DEFAULT_THEME`.

Default values include:

- Helvetica fonts.
- 11 point base font size.
- primary blue.
- muted gray.
- table header fill.
- table stripe fill.

### `mergeTheme(theme)`

Combines defaults with caller-provided theme.

User theme wins over default theme.

## 13. Validation

### `src/core/validation.ts`

### `assertDocumentDefinition`

Checks:

- definition exists
- definition is object
- `content` is an array
- every content block is object-like and has a string `type`

This is intentionally lightweight validation.

Future improvement:

- Add full schema validation for every block type.

## 14. HTML Adapter

### `src/adapters/html.ts`

The `HtmlRenderer` class renders HTML, HTML files, and URLs through Playwright Chromium.

### `fromHtml(html, options)`

Steps:

1. Launch browser.
2. Open new page.
3. Apply media if specified.
4. Wrap HTML if needed.
5. Set page content.
6. Generate PDF.
7. Return `PdfArtifact`.
8. Always close browser in `finally`.

### `fromHtmlFile(path, options)`

Steps:

1. Verifies file exists.
2. Converts path to `file://` URL.
3. Delegates to `fromUrl`.

### `fromUrl(url, options)`

Steps:

1. Launch browser.
2. Open new page.
3. Apply media if specified.
4. Navigate to URL.
5. Add custom CSS if provided.
6. Generate PDF.
7. Return `PdfArtifact`.
8. Always close browser in `finally`.

### `launch()`

Launches Chromium headless.

### `wrapHtml(html, options)`

Ensures raw fragments become full HTML documents.

If caller provides full HTML, it injects base URL and CSS into the `<head>`.

If caller provides a fragment, it creates:

```html
<!doctype html>
<html>
  <head>...</head>
  <body>...</body>
</html>
```

### `toPlaywrightPdfOptions(options)`

Converts Aurora options into Playwright `page.pdf` options.

Important conversions:

- page size preset or custom size
- margins
- print background
- landscape
- headers
- footers
- page numbering

### `toCssMargin(margin)`

Converts PDF points to inches.

Reason:

- Playwright PDF margins accept CSS units like `in`.

### `textHeaderFooter`

Builds Playwright header/footer HTML from plain text.

### `pageNumberTemplate`

Builds Playwright footer HTML with:

- `<span class="pageNumber"></span>`
- `<span class="totalPages"></span>`

Playwright fills these automatically.

## 15. Markdown Adapter

### `src/adapters/markdown.ts`

Markdown rendering uses:

- MarkdownIt to convert Markdown to HTML.
- HtmlRenderer to render that HTML to PDF.

### `fromMarkdown(markdown, options)`

Steps:

1. Convert Markdown to HTML body.
2. Wrap it in a complete HTML page.
3. Generate default Markdown CSS from theme.
4. Append caller CSS.
5. Delegate to `HtmlRenderer.fromHtml`.

### `fromMarkdownFile(path, options)`

Reads file text, then calls `fromMarkdown`.

### `wrap(body, options)`

Creates a full HTML page with a title and `<main>` element.

### `css(options)`

Generates readable default CSS for:

- body
- headings
- paragraphs
- links
- tables
- code
- preformatted code
- images

## 16. Image Adapter

### `src/adapters/image.ts`

Image handling has two layers:

- `normalizeImage`
- `imagesToPdf`

### `normalizeImage(input, options)`

Steps:

1. Reads input bytes through `readBinary`.
2. Loads the image with Sharp.
3. Reads image metadata.
4. Throws if width or height cannot be determined.
5. Optionally resizes inside max width and height.
6. If image has alpha, outputs PNG.
7. If image has no alpha, outputs JPEG.
8. Returns bytes, width, height, and format.

Reason:

- PDFKit and pdf-lib need predictable image bytes.
- PNG is better for transparency.
- JPEG is smaller for photos.

### `imagesToPdf(images, options)`

Steps:

1. Normalizes page setup.
2. Resolves page width and height.
3. Creates PDFKit document.
4. For each image:
   - normalize image
   - add page
   - draw background
   - calculate content box
   - calculate contain or cover dimensions
   - center image
   - draw image
5. Ends PDFKit document.
6. Returns `PdfArtifact`.

## 17. Existing PDF Modifier

### `src/adapters/modifier.ts`

`PdfModifier` uses `pdf-lib`.

It works with existing PDF bytes.

### `merge(inputs, options)`

Steps:

1. Create target PDF.
2. For each input:
   - read binary
   - load source PDF
   - copy all pages
   - add copied pages to target
3. Apply metadata.
4. Save with object streams.
5. Return `PdfArtifact`.

### `split(input, options)`

Steps:

1. Load source PDF.
2. Determine page count.
3. Use provided ranges or default to one output per page.
4. For each range:
   - clamp range to valid page numbers
   - copy selected pages
   - save a new PDF
   - push artifact
5. Return artifact array.

Page numbers in ranges are 1-based.

### `setMetadata(input, metadata)`

Loads PDF, applies metadata, saves PDF.

### `addWatermark(input, options)`

Supports text or image watermark.

Steps:

1. Load PDF.
2. Embed Helvetica bold.
3. Select all pages or first page.
4. Optionally embed watermark image.
5. For each page:
   - calculate position
   - draw image watermark if provided
   - draw text watermark if provided
6. Save PDF.

Defaults:

- rotation: `-32` degrees
- opacity: `0.18`
- position: center
- font size: `54`
- color: gray

### `insertLogo(input, options)`

Steps:

1. Load PDF.
2. Embed logo image.
3. Select all pages or first page.
4. Calculate corner position.
5. Draw logo.
6. Save PDF.

Default:

- position: top-right
- margin: 36 points
- width: 96 points

### `attachFiles(input, attachments)`

Steps:

1. Load PDF.
2. For each attachment:
   - read attachment bytes
   - attach with name, MIME type, description, dates
3. Save PDF.

### `addPageNumbers(input, options)`

Steps:

1. Load PDF.
2. Embed Helvetica.
3. For each page:
   - calculate label
   - center label
   - draw at y=24
4. Save PDF.

### `optimize(input, options)`

Loads and re-saves PDF.

Options:

- `useObjectStreams`
- `stripMetadata`

Current limitation:

- `removeJavaScript` exists in the type but is not deeply implemented yet.

### `compress(input, options)`

Currently delegates to `optimize`.

Important:

- This is structural PDF compression through saving/object streams.
- It does not currently downsample images inside existing PDFs.

### `encrypt(input, options)`

Delegates to `encryptPdf`.

### Modifier Helper Functions

#### `applyMetadata`

Maps `PdfMetadata` to pdf-lib setters.

#### `embedImage`

Normalizes image, then embeds PNG or JPG.

#### `resolvePosition`

Calculates watermark position.

#### `cornerPosition`

Calculates logo position.

## 18. Encryption

### `src/security/encryption.ts`

Exports `encryptPdf`.

### `encryptPdf(input, options)`

Steps:

1. Requires `userPassword`.
2. Reads PDF bytes.
3. Calls `encryptPDF`.
4. Maps Aurora permissions to adapter permission flags.
5. Returns encrypted `PdfArtifact`.

Permission mapping:

```text
printing          -> allowPrinting
modifying         -> allowModifying
copying           -> allowCopying
annotating        -> allowAnnotating
fillingForms      -> allowFillingForms
extraction        -> allowExtraction
assembly          -> allowAssembly
highQualityPrint  -> allowHighQualityPrint
```

Important:

- PDF permissions are advisory. Compliant readers enforce them, but hostile tools may ignore them.
- Use application-level storage security for sensitive files.

## 19. Utility Files

### `src/utils/bytes.ts`

This file normalizes byte input and output.

#### `readBinary(input)`

Accepts:

- `URL`
- HTTP/HTTPS string
- data URI string
- local file path string
- Buffer
- ArrayBuffer
- Uint8Array or other ArrayBuffer views

Returns:

- `Uint8Array`

#### `ensureFileExists(path)`

Checks that a path exists and is a file.

Throws:

- `MISSING_FILE`
- `INVALID_FILE`

#### `toBuffer(bytes)`

Creates a Node Buffer from `Uint8Array`.

#### `writeBytes(path, bytes)`

Writes bytes to disk with file mode `0o600`.

#### `streamFromBytes(bytes)`

Creates a readable stream from bytes.

#### `fileStream(path)`

Creates a file read stream.

#### `streamToBytes(stream)`

Reads a stream completely into `Uint8Array`.

#### `writeStreamSecurely(path, stream)`

Writes a stream through a private temporary path and then renames it.

#### `createSecureTempDir()`

Creates an OS temp directory named with `aurora-pdf-` prefix and returns:

- path
- cleanup function

#### `readFromUrl(url)`

Uses `fetch` and returns response bytes.

#### `readDataUri(uri)`

Parses a data URI and returns bytes.

### `src/utils/page.ts`

Page math helpers.

#### `PAGE_SIZES`

Maps:

- A4
- LETTER
- LEGAL

to PDF point dimensions.

#### `DEFAULT_MARGIN`

Default margin:

```ts
{ top: 54, right: 54, bottom: 54, left: 54 }
```

54 points equals 0.75 inch.

#### `resolvePageSize(size, orientation)`

Returns `[width, height]`.

If landscape, it swaps so width is larger than height.

#### `normalizeMargin(margin)`

Accepts:

- number
- partial margin object
- undefined

Returns full `{ top, right, bottom, left }`.

#### `pageSetupWithDefaults(page)`

Applies defaults for:

- size
- orientation
- margin
- bleed
- dpi
- printReady

#### `pointsToCss(value)`

Converts PDF points to CSS inches for Playwright.

#### `pageSizeToCss(size, orientation)`

Returns Playwright-friendly page size.

Preset sizes return:

- `A4`
- `Letter`
- `Legal`

Custom sizes return CSS width and height strings.

### `src/utils/color.ts`

Color conversion helpers.

#### `normalizeHex(color)`

Accepts:

- known color names
- `#rgb`
- `#rrggbb`

Returns valid `#rrggbb`.

Invalid values return default `#111827`.

#### `hexToRgbNumber(color)`

Returns `[r, g, b]` numbers from 0 to 255.

#### `hexToPdfRgb(color)`

Returns pdf-lib `rgb(...)` color object.

#### `contrastTextColor(background)`

Returns dark or white text color based on background luminance.

### `src/utils/metadata.ts`

#### `pdfKitInfo(metadata)`

Converts Aurora metadata into PDFKit info object.

Important reason:

- PDFKit 0.18 calls `valueOf()` on every info value.
- Undefined values break file ID generation.
- This helper removes undefined values and always supplies a creation date.

## 20. Errors

### `src/errors.ts`

Defines project error classes.

#### `AuroraPdfError`

Base error.

Fields:

- message
- code
- cause

#### `UnsupportedFeatureError`

For unsupported features.

#### `InvalidDocumentError`

For invalid document definitions or blocks.

#### `RenderingError`

For rendering failures, usually HTML, image, or PDF rendering problems.

## 21. CLI

### `src/cli/index.ts`

Uses Commander.

Built CLI path:

```text
dist/cli/index.js
```

Package bin name:

```text
aurora-pdf
```

### Commands

#### `html <input> <output>`

Input can be:

- URL
- raw HTML string
- file path

Option:

- `--landscape`

#### `markdown <input> <output>`

Reads Markdown file and writes PDF.

#### `images <output> <images...>`

Combines images into a PDF.

#### `merge <output> <pdfs...>`

Merges PDFs.

#### `split <input> <outDir>`

Splits one PDF into one file per page.

#### `encrypt <input> <output>`

Encrypts PDF.

Options:

- `--user-password`
- `--owner-password`
- `--no-printing`
- `--no-copying`
- `--no-modifying`

### CLI Error Handling

`program.parseAsync()` is wrapped with `.catch`.

On error:

- prints message
- sets `process.exitCode = 1`

## 22. Tests

### Test Framework

Vitest.

Config:

```text
vitest.config.ts
```

### `tests/helpers.ts`

Provides:

- `redSquareSvg` data URI fixture.
- `sampleDefinition`.
- `pageCount`.
- `startsWithPdfHeader`.

### `tests/definition.test.ts`

Covers:

- structured document rendering
- templates
- components
- tables
- images
- headers
- page numbers
- plugins
- streaming
- large table backpressure

The large table regression is important because PDF streams must be drained when collecting bytes internally.

### `tests/adapters.test.ts`

Covers:

- single image PDF
- multiple image PDF
- raw HTML rendering
- HTML file rendering
- Markdown rendering

These tests require Playwright Chromium.

### `tests/modifier.test.ts`

Covers:

- merge
- split
- metadata
- watermark
- logo
- attachments
- page numbers
- optimize
- compress
- encrypt

### `tests/cli.test.ts`

Covers:

- CLI help output.

## 23. Examples

### `examples/run-all.mjs`

This script generates sample PDFs in `samples/`.

It exercises:

- structured document rendering
- Markdown rendering
- HTML rendering
- image set rendering
- merge
- watermark
- encryption
- split

Important:

- The script imports from `../dist/index.js`.
- Therefore it requires `npm run build` first.
- The `examples` npm script already does that.

## 24. Benchmarks

### `benchmarks/large-document.mjs`

Generates a large table-heavy PDF.

It measures:

- pages
- bytes
- duration
- heap delta

Outputs:

- `samples/benchmark-large.pdf`
- `samples/benchmark-large.json`

Purpose:

- Catch performance regressions.
- Confirm large documents complete.
- Confirm page-numbering and table pagination survive multi-page output.

## 25. Build and Packaging

### `tsup.config.ts`

Builds:

- library entry
- CLI entry
- ESM
- CJS
- declarations
- source maps

Target:

- Node 20

### `package.json`

Important fields:

- `"type": "module"` means source package defaults to ESM.
- `"exports"` maps package root to ESM, CJS, and types.
- `"bin"` maps `aurora-pdf` command to CLI build.
- `"files"` controls npm package contents.
- `"engines"` requires Node `>=20.11`.

### `typedoc.json`

Generates API docs from:

```text
src/index.ts
```

Output:

```text
docs/api
```

## 26. Full Data Flows

### Structured Definition Flow

```text
User calls AuroraPDF.fromDefinition
  -> TemplateEngine renders Handlebars placeholders
  -> beforeRenderDefinition plugins run
  -> validation checks content array
  -> page defaults and theme defaults applied
  -> PDFKit document created
  -> custom fonts registered
  -> first page added
  -> each content block rendered
  -> headers, footers, page numbers added
  -> PDFKit document ended
  -> stream drained
  -> bytes collected
  -> attachments added if any
  -> optimization applied if requested
  -> encryption applied if requested
  -> afterRenderBytes plugins run
  -> PdfArtifact returned
```

### HTML Flow

```text
User calls AuroraPDF.fromHtml
  -> HtmlRenderer launches Chromium
  -> raw fragment wrapped if needed
  -> content loaded in page
  -> Playwright page.pdf called
  -> browser closed
  -> PdfArtifact returned
```

### Markdown Flow

```text
User calls AuroraPDF.fromMarkdown
  -> MarkdownIt converts Markdown to HTML
  -> default CSS generated
  -> HtmlRenderer renders HTML
  -> PdfArtifact returned
```

### Image Flow

```text
User calls AuroraPDF.fromImages
  -> each image read into bytes
  -> Sharp normalizes format and dimensions
  -> PDFKit creates one page per image
  -> image fitted into page box
  -> PdfArtifact returned
```

### Existing PDF Modification Flow

```text
User calls AuroraPDF.merge/split/watermark/etc.
  -> readBinary loads input bytes
  -> pdf-lib loads PDF
  -> operation modifies pages/catalog/metadata
  -> pdf-lib saves bytes
  -> PdfArtifact returned
```

### Encryption Flow

```text
User calls AuroraPDF.encrypt
  -> userPassword validated
  -> input bytes read
  -> @pdfsmaller/pdf-encrypt encrypts
  -> permissions mapped
  -> PdfArtifact returned
```

## 27. How to Add a New Structured Block

Example: add a `quote` block.

Steps:

1. Add `QuoteBlock` interface in `src/types.ts`.
2. Add it to `ContentBlock` union.
3. Add a `case "quote"` branch in `renderBlock`.
4. Implement `renderQuote`.
5. Add tests in `tests/definition.test.ts`.
6. Add example usage in `examples/run-all.mjs` if useful.
7. Run:

```bash
npm run build
npm test
npm run examples
npm run docs
```

## 28. How to Add a New PDF Modification Operation

Example: rotate pages.

Steps:

1. Add option type in `src/types.ts`.
2. Add method in `PdfModifier`.
3. Add facade method in `AuroraPDF`.
4. Export types through `src/index.ts` if needed.
5. Add tests in `tests/modifier.test.ts`.
6. Add docs and examples.
7. Run verify.

## 29. How to Add a New CLI Command

Steps:

1. Add command to `src/cli/index.ts`.
2. Delegate to `AuroraPDF`.
3. Build.
4. Run CLI help.
5. Add CLI test if behavior is important.

Commands:

```bash
npm run build
node dist/cli/index.js --help
npm test
```

## 30. How to Add a New Rendering Backend

Example: qpdf backend for stronger optimization.

Recommended pattern:

1. Create new adapter file under `src/adapters`.
2. Keep backend-specific dependencies isolated.
3. Add public option types to `src/types.ts`.
4. Add a small facade method in `AuroraPDF`.
5. Add tests for success and failure cases.
6. Document backend installation requirements.

Avoid mixing backend-specific logic into `AuroraPDF`.

## 31. Known Limitations

Current limitations are acceptable for version `0.1.0`, but should be understood.

- Structured table rendering is basic and does not repeat headers on each page.
- Structured columns are simple and do not rebalance across pages.
- `compress` currently delegates to `optimize`; it does not downsample images inside existing PDFs.
- `OptimizeOptions.removeJavaScript` is reserved but not deeply implemented.
- `EncryptOptions.protectMetadata` is reserved, but strict metadata redaction should use `optimize({ stripMetadata: true })` before encryption.
- HTML/URL/Markdown rendering requires Chromium.
- PDF permissions are advisory in the PDF standard.

## 32. Debugging Guide

### If structured output is wrong

Look at:

- `src/core/renderer.ts`
- `tests/definition.test.ts`
- `examples/run-all.mjs`

Check:

- page margins
- current `doc.y`
- `ensureSpace`
- content width
- row height
- header/footer positions

### If HTML output is wrong

Look at:

- `src/adapters/html.ts`

Check:

- `waitUntil`
- CSS injection
- page margins
- header/footer templates
- Chromium installation

### If Markdown output is wrong

Look at:

- `src/adapters/markdown.ts`

Check:

- MarkdownIt output
- generated CSS
- HtmlRenderer behavior

### If images fail

Look at:

- `src/adapters/image.ts`
- `src/utils/bytes.ts`

Check:

- input path
- data URI format
- Sharp metadata
- image format
- alpha channel

### If PDF modification fails

Look at:

- `src/adapters/modifier.ts`

Check:

- whether input PDF is encrypted
- page range numbers
- image normalization
- metadata setters

### If encryption fails

Look at:

- `src/security/encryption.ts`

Check:

- user password exists
- input bytes are valid PDF
- algorithm value
- permission options

## 33. Beginner Concepts

### PDF Points

PDFKit and pdf-lib use points.

```text
72 points = 1 inch
```

A4 is approximately:

```text
595.28 x 841.89 points
```

### Uint8Array vs Buffer

The library mostly uses `Uint8Array` because it is a common binary type across Node, browser, and Web APIs.

Node `Buffer` is converted when writing files or passing data to Node-specific APIs.

### ESM and CJS

The package supports both:

```ts
import { AuroraPDF } from "aurora-pdf";
```

and:

```js
const { AuroraPDF } = require("aurora-pdf");
```

`tsup` creates both builds.

### Source vs Dist

Development source is in:

```text
src/
```

Compiled package output is in:

```text
dist/
```

Examples import from `dist`, so build before examples.

## 34. Code Review Checklist

Before approving changes, check:

- Does the change preserve public API types?
- Are new options documented in `src/types.ts` and docs?
- Are tests added for new behavior?
- Does HTML/Markdown behavior still pass with Chromium installed?
- Does structured rendering still handle large documents?
- Does `npm run verify` pass?
- Does `npm pack --dry-run` include expected files?
- Are errors clear for beginner users?
- Are secrets/passwords never logged?

## 35. Handoff Summary for a New Developer

Start learning in this order:

1. Read `README.md`.
2. Run `docs/setup-and-testing-guide.md`.
3. Read `src/types.ts` to understand the public data model.
4. Read `src/api.ts` to understand the public facade.
5. Read `src/core/renderer.ts` to understand structured rendering.
6. Read adapters under `src/adapters`.
7. Read `tests/` to see expected behavior.
8. Run `npm run verify`.
9. Modify one small example in `examples/run-all.mjs` and regenerate samples.

The most important mental model:

```text
AuroraPDF is the public front door.
Types define the contract.
Adapters do backend-specific work.
PdfArtifact is the standard output wrapper.
Tests and examples prove the workflows.
```

