# Contributing

Use Node.js 22 or 24. Create a branch, make focused changes, add tests for changed behavior, and run:

```bash
npm ci
npm run check
npm run smoke
npm audit
```

Never commit credentials or fixtures containing copyrighted media. Upstream response fixtures must contain only metadata and links. Keep provider-specific data inside adapters and preserve the privacy/security boundaries. Pull requests should explain user-visible changes and any Watchmode plan assumptions.
