# Release Instructions

## Preflight

```bash
npm ci
npx playwright install chromium
npm run verify
```

Confirm that:

- ESM and CJS bundles are created in `dist`.
- Type declarations are present.
- Tests pass.
- Samples are generated.
- Benchmark output exists.
- TypeDoc output exists in `docs/api`.

## Version

```bash
npm version patch
```

Use `minor` for new public APIs and `major` for breaking changes.

## Publish

```bash
npm publish --access public
```

## Post-release

- Create a GitHub release from the version tag.
- Attach generated benchmark numbers.
- Link to docs and samples.
- Document any backend dependency changes, especially Playwright, Sharp, and encryption adapter updates.
