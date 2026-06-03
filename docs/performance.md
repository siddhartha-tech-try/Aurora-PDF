# Performance

Aurora PDF favors backend selection over one-size-fits-all rendering.

## Structured Reports

Use `fromDefinition` or `streamDefinition` for invoices, statements, reports, certificates, batch documents, and table-heavy output.

Structured rendering uses PDFKit and can stream. This avoids browser startup and gives predictable memory usage.

## HTML and URL Rendering

Use HTML or URL rendering for CSS-heavy documents, branded layouts, and pages that already exist in a web application.

Chromium startup is more expensive than structured rendering. For batch jobs, run with controlled concurrency and avoid launching hundreds of jobs at once.

## Image Sets

Images are normalized with Sharp. Use `quality`, `fit`, and page DPI options to tune output size.

## Benchmark

```bash
npm run benchmark
```

The benchmark writes:

- `samples/benchmark-large.pdf`
- `samples/benchmark-large.json`

The JSON report includes page count, byte size, elapsed time, and heap growth.

## Practical Defaults

- Use `optimize: { useObjectStreams: true }` for most generated PDFs.
- Use structured definitions for large dynamic reports.
- Keep HTML rendering concurrency low on small servers.
- Downsample large source images before embedding when print quality permits it.
