# Security

Report vulnerabilities privately to the repository owner through GitHub Security Advisories when available. Do not include live API keys, provider credentials, or user URLs in a public issue.

The service accepts only public read-only requests. Keep `WATCHMODE_API_KEY` server-side, deploy over HTTPS, set a canonical `PUBLIC_BASE_URL` when using a custom proxy, keep dependencies updated, and review `npm audit` output. The permissive CORS policy is required for Stremio/Nuvio clients and is safe only because there are no authenticated mutation routes.

Destination validation allows HTTPS only and rejects credentials, control characters, loopback/private/link-local/metadata hosts, and known generic redirect wrappers. It does not fetch destinations, which removes the usual SSRF request path. Do not weaken this to fetch, expand, or probe upstream links without a separate security review.

Supported releases receive security fixes on the current `1.x` line.
