# Changelog

## 1.1.0 - 2026-08-03

- Discover all validated regional providers by default instead of limiting results to Apple TV+.
- Rank a title's detected original network or home service ahead of subscription preferences.
- Support TMDB movie and series IDs, including season-zero specials, in addition to IMDb IDs for broader TV and anime coverage.
- Verify returned episode season/episode numbers before using exact links; otherwise show an explicitly labeled official series-page fallback with the requested episode number.
- Avoid spending free-plan quota on Watchmode's unavailable episode endpoint unless explicitly enabled.
- Reject obvious episode-specific URLs from series-page fallbacks so a fallback cannot open an unrelated episode.
- Collapse raw premium-tier and marketplace-channel variants into one consumer-facing subscription checkbox on the configuration page.
- Hide unselected paid subscriptions by default while continuing to show eligible free sources globally.
- Make service selection resilient to stale cached scripts and enlarge the clickable checkbox target.
- Migrate v1 Apple-only installation tokens to the broader v2 defaults automatically.

## 1.0.0 - 2026-08-02

- Initial deployable MVP with configurable provider selection and ranking.
- Movie and episode availability through Watchmode, including labeled series fallback.
- Strict configuration tokens, URL security, caching/deduplication, structured logging, and graceful failures.
- Responsive configuration UI, GitHub Actions, Railway configuration, and complete automated tests/smoke checks.
