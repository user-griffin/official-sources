# Architecture

`createApp` composes an Express transport around four replaceable boundaries: `AvailabilityProvider`, `Cache`, `RankingEngine`, and `Logger`. The production adapter is `WatchmodeClient`; tests inject an in-memory mock. `MemoryTtlCache` stores values and shares in-flight requests, so adapters can be replaced without changing route logic.

The request flow is: validate config token → parse IMDb media ID → resolve title → request normalized offers → validate destinations → apply user filters → collapse exact duplicates → deterministic rank → map to standard Stremio external streams. Watchmode response objects are Zod-validated and do not cross the adapter boundary.

Security is layered: header-based Watchmode authentication, timeouts and bounded retry, strict request/token/response validation, HTTPS-only destinations, local/private/metadata/redirect-wrapper rejection, Helmet/CSP, host validation, request-size limits, rate limits, redacted structured logs, safe JSON failures, and graceful shutdown. The server never dereferences a destination URL.

There is no database or background worker. Configuration lives in the manifest URL. A future licensed provider adapter (including a JustWatch Partner adapter) can implement `AvailabilityProvider` without changing ranking or Stremio formatting.
