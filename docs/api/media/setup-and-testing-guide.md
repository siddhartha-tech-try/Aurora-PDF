# Aurora PDF Setup and Testing Guide

This guide explains how a developer should set up, verify, test, and troubleshoot Aurora PDF after cloning the repository.

Use this document when:

- You cloned the repository for the first time.
- You need to confirm the project works on a new machine.
- You need to run the same verification flow before a release.
- You need to regenerate examples, sample PDFs, benchmarks, or API docs.

## 1. What This Project Needs

Aurora PDF is a Node.js and TypeScript project. It uses:

- `tsup` to build ESM, CJS, source maps, and type declarations.
- `vitest` for automated tests.
- `typedoc` for generated API reference documentation.
- `playwright` and Chromium for HTML, URL, and Markdown rendering.
- `pdfkit` for structured PDF generation.
- `pdf-lib` for modifying existing PDFs.
- `sharp` for image normalization.
- `@pdfsmaller/pdf-encrypt` for PDF password protection and permissions.

## 2. Required Software

Install these before running the project:

- Node.js `20.11` or newer.
- npm, bundled with Node.js.
- Git.
- Internet access for first install, because npm packages and Playwright Chromium must be downloaded.

Recommended:

- Node.js `22.x` or `24.x` for current development.
- PowerShell, Windows Terminal, Git Bash, or a normal Unix shell.

Check versions:

```bash
node --version
npm --version
git --version
```

Expected:

- `node --version` should be `v20.11.0` or newer.
- `npm --version` should print a valid npm version.

On Windows PowerShell, if `npm --version` fails with an execution policy error, use:

```powershell
npm.cmd --version
```

The same rule applies to other npm commands:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run verify
```

## 3. Fresh Clone Setup

Clone the repository:

```bash
git clone <repository-url>
cd aurora-pdf
```

Install dependencies exactly from the lockfile:

```bash
npm ci
```

If you are on Windows PowerShell and npm scripts are blocked:

```powershell
npm.cmd ci
```

Install the Chromium browser used by Playwright:

```bash
npx playwright install chromium
```

On Windows PowerShell:

```powershell
npx.cmd playwright install chromium
```

Why this step is required:

- `fromHtml`
- `fromHtmlFile`
- `fromUrl`
- `fromMarkdown`
- `fromMarkdownFile`

all render through Playwright. These methods need a local Chromium executable.

Structured PDF generation, image PDFs, merge, split, metadata edits, watermarking, and encryption do not need Chromium.

## 4. First Verification Command

Run the full maintainer verification command:

```bash
npm run verify
```

On Windows PowerShell:

```powershell
npm.cmd run verify
```

This command runs:

```bash
npm run build
npm test
npm run examples
npm run benchmark
npm run docs
```

If `npm run verify` passes, the repository is ready for local development.

## 5. What Each Script Does

### `npm run build`

Builds the library.

Outputs:

- `dist/index.js`
- `dist/index.cjs`
- `dist/index.d.ts`
- `dist/index.d.cts`
- `dist/cli/index.js`
- `dist/cli/index.cjs`
- source maps

The build uses `tsup.config.ts`.

Use this when:

- You changed source code under `src/`.
- You changed package exports.
- You want to test the compiled library.

Command:

```bash
npm run build
```

### `npm test`

Runs the automated test suite with Vitest.

Tests cover:

- Structured document rendering.
- Template data binding.
- Reusable components.
- Plugin hooks.
- Streaming generation.
- Large table backpressure regression.
- Image rendering.
- HTML file rendering.
- Raw HTML rendering.
- Markdown rendering.
- PDF merge.
- PDF split.
- Metadata edits.
- Watermarking.
- Logo insertion.
- Attachments.
- Page numbering.
- Optimization.
- Compression alias.
- Encryption.
- CLI help.

Command:

```bash
npm test
```

### `npm run examples`

Builds the library and runs `examples/run-all.mjs`.

It generates real PDFs in `samples/`:

- `samples/structured.pdf`
- `samples/markdown.pdf`
- `samples/html.pdf`
- `samples/image-set.pdf`
- `samples/merged.pdf`
- `samples/watermarked.pdf`
- `samples/encrypted.pdf`
- `samples/split/page-1.pdf`

Command:

```bash
npm run examples
```

### `npm run benchmark`

Builds the library and runs `benchmarks/large-document.mjs`.

It generates:

- `samples/benchmark-large.pdf`
- `samples/benchmark-large.json`

The JSON report contains:

- generation timestamp
- page count
- output byte size
- duration in milliseconds
- heap memory delta in megabytes

Command:

```bash
npm run benchmark
```

### `npm run docs`

Runs TypeDoc and generates HTML API docs.

Output:

- `docs/api/index.html`
- generated class, interface, function, and type reference pages

Command:

```bash
npm run docs
```

### `npm run clean`

Deletes `dist/`.

Command:

```bash
npm run clean
```

Use this before a clean build if you suspect old compiled files are confusing local testing.

### `npm run test:watch`

Runs Vitest in watch mode.

Command:

```bash
npm run test:watch
```

Use this while actively changing source or tests.

## 6. Suggested Setup Flow for a New Developer

Run commands in this order:

```bash
git clone <repository-url>
cd aurora-pdf
npm ci
npx playwright install chromium
npm run build
npm test
npm run examples
npm run benchmark
npm run docs
npm pack --dry-run
```

If everything passes, run the shorter all-in-one command before pushing changes:

```bash
npm run verify
```

## 7. Expected Healthy Results

A healthy build should show:

- ESM build success.
- CJS build success.
- DTS build success.

A healthy test run should show all test files and tests passing.

At the time this guide was written, the suite contained:

- `4` test files.
- `11` tests.

The exact number may grow as the project evolves.

A healthy examples run should print:

```text
Generated sample PDFs in samples/
```

A healthy benchmark run should print JSON similar to:

```json
{
  "generatedAt": "2026-06-03T13:05:34.541Z",
  "pages": 22,
  "bytes": 37708,
  "durationMs": 310.82,
  "heapDeltaMb": 0.58
}
```

Exact benchmark numbers will vary by machine.

## 8. Validating Generated Sample PDFs

After running examples and benchmark, check sample files:

```bash
ls samples
```

On PowerShell:

```powershell
Get-ChildItem samples -Recurse
```

Expected important files:

```text
samples/structured.pdf
samples/markdown.pdf
samples/html.pdf
samples/image-set.pdf
samples/merged.pdf
samples/watermarked.pdf
samples/encrypted.pdf
samples/benchmark-large.pdf
samples/benchmark-large.json
samples/split/page-1.pdf
```

Optional PDF sanity check:

```bash
node -e "const {readFileSync}=require('node:fs'); for (const f of ['samples/structured.pdf','samples/markdown.pdf','samples/html.pdf']) console.log(f, readFileSync(f).subarray(0,5).toString('ascii'))"
```

Expected output should show `%PDF-`.

## 9. Running CLI Commands Locally

Build first:

```bash
npm run build
```

Then run the CLI through Node:

```bash
node dist/cli/index.js --help
```

Examples:

```bash
node dist/cli/index.js markdown README.md readme.pdf
node dist/cli/index.js html ./page.html page.pdf
node dist/cli/index.js images album.pdf image1.jpg image2.png
node dist/cli/index.js merge merged.pdf one.pdf two.pdf
node dist/cli/index.js split merged.pdf split-output
node dist/cli/index.js encrypt merged.pdf protected.pdf --user-password open --owner-password admin --no-copying
```

## 10. Packaging Dry Run

Before publishing, run:

```bash
npm pack --dry-run
```

This checks what would be included in the npm tarball.

The package should include:

- `dist/`
- `README.md`
- `docs/`
- generated TypeDoc API docs if present

The package should not include:

- `node_modules/`
- `coverage/`
- temporary files

## 11. CI Expectations

The GitHub Actions workflow is at:

```text
.github/workflows/ci.yml
```

It runs on:

- push to `main`
- pull request to `main`

It tests Node:

- `20.x`
- `22.x`
- `24.x`

The CI flow:

```bash
npm ci
npx playwright install chromium --with-deps
npm run build
npm test
npm run examples
npm run benchmark
```

## 12. Common Problems and Fixes

### Problem: PowerShell blocks `npm.ps1`

Error:

```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

Fix:

```powershell
npm.cmd ci
npm.cmd run verify
```

This uses `npm.cmd` instead of the blocked PowerShell shim.

### Problem: Playwright browser executable is missing

Error:

```text
browserType.launch: Executable doesn't exist
Looks like Playwright was just installed or updated.
Please run: npx playwright install
```

Fix:

```bash
npx playwright install chromium
```

On CI Linux images, use:

```bash
npx playwright install chromium --with-deps
```

### Problem: HTML or Markdown tests timeout

Likely causes:

- Playwright Chromium is missing.
- Network URL rendering waits too long.
- `waitUntil: "networkidle"` is waiting for long-running requests.

Fixes:

- Install Chromium.
- Use `waitUntil: "load"` for simple HTML tests.
- Set `timeoutMs`.
- Avoid remote URLs in automated tests unless necessary.

### Problem: TypeDoc fails while build passes

TypeDoc runs TypeScript analysis differently from bundling. It may catch strict typing issues hidden by bundling.

Fix:

```bash
npm run docs
```

Read the TypeScript error, patch the source type, then rerun:

```bash
npm run build
npm run docs
```

### Problem: Generated PDF has extra blank pages

Likely causes:

- Header or footer text was drawn below the safe content area.
- A block height exceeded remaining page space.
- A table row is too tall.

Relevant code:

- `src/core/renderer.ts`
- `ensureSpace`
- `renderHeaderFooterText`
- `renderPageNumber`
- `renderTable`

Run:

```bash
npm test
npm run examples
```

Then inspect sample PDFs.

### Problem: Large document generation hangs

This project intentionally drains the internal stream in `DocumentRenderer.render()`:

```ts
streamResult.stream.resume();
```

That prevents PDFKit stream backpressure when the caller wants a `PdfArtifact` instead of manually reading a stream.

Regression coverage exists in:

```text
tests/definition.test.ts
```

Run:

```bash
npm test
npm run benchmark
```

### Problem: Encryption output will not load with pdf-lib

Encrypted PDFs may require a password-aware reader. The test suite checks for the `/Encrypt` dictionary instead of loading the encrypted output as a normal document.

Relevant files:

- `src/security/encryption.ts`
- `tests/modifier.test.ts`

### Problem: Sharp fails during install

Sharp uses platform-specific binaries.

Fixes:

```bash
npm ci
npm rebuild sharp
```

If behind a corporate proxy, configure npm proxy settings before install.

## 13. Development Workflow

Recommended loop for code changes:

```bash
npm run build
npm test
```

For adapter or rendering changes:

```bash
npm test
npm run examples
```

For performance-sensitive changes:

```bash
npm run benchmark
```

For public API/type changes:

```bash
npm run build
npm run docs
npm pack --dry-run
```

Before handing off or opening a release PR:

```bash
npm run verify
npm pack --dry-run
```

## 14. What to Commit After Verification

Commit source and documentation:

- `src/`
- `tests/`
- `examples/`
- `benchmarks/`
- `docs/`
- `README.md`
- `package.json`
- `package-lock.json`
- config files

Do not commit:

- `node_modules/`
- `coverage/`
- temporary files

Whether to commit `dist/` depends on the repository policy. For normal npm libraries, `dist/` is generated during packaging and often ignored.

Whether to commit generated sample PDFs depends on repository policy. In this project, sample PDFs are useful deliverables, so keeping them can be reasonable if file size stays small.

## 15. Release Preflight

Run:

```bash
npm ci
npx playwright install chromium
npm run verify
npm pack --dry-run
```

Then check:

- package name
- version
- exports
- CLI bin path
- generated declarations
- README examples
- docs
- benchmark output
- sample PDFs

Follow the release checklist in:

```text
docs/release.md
```

