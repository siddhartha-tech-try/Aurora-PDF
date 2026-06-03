# API Reference

The generated TypeDoc reference is produced with:

```bash
npm run docs
```

The most important entry point is `AuroraPDF`.

## Generation

```ts
AuroraPDF.fromDefinition(definition, options)
AuroraPDF.streamDefinition(definition, options)
AuroraPDF.fromHtml(html, options)
AuroraPDF.fromHtmlFile(path, options)
AuroraPDF.fromUrl(url, options)
AuroraPDF.fromMarkdown(markdown, options)
AuroraPDF.fromMarkdownFile(path, options)
AuroraPDF.fromImage(image, options)
AuroraPDF.fromImages(images, options)
```

All generation methods return `Promise<PdfArtifact>` except `streamDefinition`, which returns a stream plus a completion promise.

## Modification

```ts
AuroraPDF.merge(inputs, options)
AuroraPDF.split(input, options)
AuroraPDF.compress(input, options)
AuroraPDF.optimize(input, options)
AuroraPDF.setMetadata(input, metadata)
AuroraPDF.watermark(input, options)
AuroraPDF.insertLogo(input, options)
AuroraPDF.attachFiles(input, attachments)
AuroraPDF.addPageNumbers(input, options)
```

PDF inputs can be byte arrays, buffers, array buffers, paths, or URLs.

## Security

```ts
AuroraPDF.encrypt(input, {
  userPassword: "open",
  ownerPassword: "admin",
  algorithm: "AES-256",
  permissions: {
    printing: true,
    copying: false,
    modifying: false
  }
});
```

## Artifact

`PdfArtifact` contains:

- `bytes`
- `byteLength`
- `toBuffer()`
- `toUint8Array()`
- `stream()`
- `save(path)`
- `pageCount()`
