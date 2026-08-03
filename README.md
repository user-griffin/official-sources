# Official Sources

Official Sources is an open-source, Stremio-compatible availability addon designed primarily for Nuvio TV. It places legitimate subscription, free, ad-supported, TV Everywhere, rental, and purchase destinations in a user's source list. Selecting a result opens the provider's official Android/Android TV destination when Watchmode supplies one, otherwise its exact official HTTPS title page.

It does **not** play, download, proxy, decrypt, scrape, or redistribute video. It does not accept provider credentials, cookies, access tokens, manifests, DRM licenses, streams, or viewing history. Authentication, entitlement checks, DRM, and playback stay in the provider app or website.

Official Sources is an independent, unofficial project and is not affiliated with Nuvio, Stremio, Watchmode, Apple, Netflix, Amazon, Disney, Warner Bros. Discovery, or any streaming provider.

## How it works

The configuration page retrieves the provider catalog through the server, then encodes non-sensitive preferences into a versioned base64url token in the addon URL. On a source request, the server validates the token and IMDb ID, looks up Watchmode availability, validates destinations, filters and ranks offers, and returns standard Stremio `externalUrl` streams. There is no database.

Provider order is deterministic inside this addon. Nuvio controls order between addons. After installation, open Nuvio's installed addon list and move **Official Sources** to the top so its group appears before later addons. Nuvio may still prioritize direct-debrid groups according to its own current behavior.

## Configure and install

1. Open `/configure` on the deployed service.
2. Enter a two-letter region, choose subscriptions, and move providers into priority order.
3. Choose allowed offer types and fallback behavior.
4. Copy the generated HTTPS manifest URL or use **Install / open**.
5. Add that URL in Nuvio or Stremio, then reorder the addon in Nuvio as described above.

Configured manifest format:

```text
https://YOUR-DOMAIN/c/BASE64URL_CONFIG_TOKEN/manifest.json
```

The unconfigured `/manifest.json` advertises that configuration is required. Configuration tokens contain preferences only—not credentials or API keys.

## Watchmode and deep-link limitations

Set `WATCHMODE_API_KEY` on the server. Current Watchmode documentation recommends `X-API-Key`; this project never puts the key into a query string, browser code, token, response, or log. Provider catalog data is live when the key is available and falls back to a small list when it is not. Stream requests without a key safely return no results.

Watchmode plan capabilities vary. Android links may contain a paid-plan placeholder on free plans; Android TV fields appear only when TV links are enabled; exact episode web/deep links are also paid-plan-dependent. The addon rejects placeholder values and never invents URLs. HTTPS links may open installed apps through Android App Links. Otherwise Android opens a browser. Some providers expose only a series page, so direct episode navigation cannot be guaranteed. Provider apps behave differently and this addon does not verify subscriptions.

Availability data is provided by [Watchmode](https://www.watchmode.com/). Confirm your account's attribution and caching obligations before a public deployment.

## Local development

Requirements: Node.js 22 or 24 and npm.

```bash
cp .env.example .env
npm install
npm run dev
```

Production:

```bash
npm ci
npm run build
npm start
```

The server binds `0.0.0.0:$PORT` (default `7000`). Normal verification is `npm run check`. A built local acceptance smoke test is `npm run smoke`. Live Watchmode testing is opt-in: `WATCHMODE_API_KEY=... npm run test:live`; CI never runs it.

## Railway deployment

1. Create a GitHub repository and push this project, including `package-lock.json`.
2. In Railway, create a project from that GitHub repository.
3. Add the required `WATCHMODE_API_KEY` service variable.
4. Optionally add variables from `.env.example`; normally let Railway supply `PORT` and `RAILWAY_PUBLIC_DOMAIN`.
5. Generate a public domain in Railway networking settings.
6. The included `railway.toml` builds with `npm ci && npm run build`, starts with `npm start`, and checks `/health`; confirm those settings in the dashboard if overridden.
7. Wait for the deployment, then open `/health`, `/manifest.json`, and `/configure`.
8. Generate and install a configured manifest in Nuvio, then move Official Sources to the top of the installed addon order.
9. Future pushes to the linked branch redeploy automatically under Railway's GitHub integration.

`PUBLIC_BASE_URL` takes precedence over Railway's public domain when explicitly set. `APP_VERSION`, `COMMIT_SHA`, and `BUILD_DATE` populate `/version`; Railway's commit SHA is used as a fallback.

## Privacy and security

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md). CORS is intentionally `*` because the Stremio HTTP addon protocol requires cross-origin clients; only public read-only GET routes are exposed. Destination URLs are not fetched by the server. Standard hosting infrastructure can log request metadata, with configured tokens and keys redacted by application logging.

## Troubleshooting

- Empty results: check the configured region, selected services/offer types, Watchmode key and quota, and whether Watchmode has the title.
- A browser opens instead of an app: the provider may not have claimed that HTTPS App Link, its app may be absent, or an Android default may override it.
- Series page instead of episode: exact links are provider- and Watchmode-plan-dependent; the result is explicitly labeled.
- Official Sources appears later: reorder installed addons in Nuvio. This addon cannot globally outrank other addon groups.

See [ARCHITECTURE.md](ARCHITECTURE.md), [RESEARCH.md](RESEARCH.md), and [CONTRIBUTING.md](CONTRIBUTING.md) for implementation details.
