# Privacy

- No user accounts are created.
- No streaming-service usernames, passwords, cookies, sessions, provider tokens, manifests, DRM licenses, playback streams, or viewing history are requested or stored.
- No analytics are enabled by default and there is no viewing-history database.
- Playback is never proxied; the official app or website handles authentication, entitlement, DRM, and playback.
- Non-sensitive configuration is encoded in the installation URL. Anyone who receives that URL can read those preferences, so treat it as personal even though it contains no credential.
- Standard server and Railway infrastructure may process request metadata such as time, IP address, user agent, route, and status. Application logs use a redacted route and short one-way token fingerprint where needed, not the complete token.
- Watchmode receives title lookup and availability requests from this server, including IMDb/Watchmode title IDs and the configured country. It does not receive the user's configuration token from this application.
- Railway may process normal infrastructure and application logs under its own terms.

Self-hosters control retention and should configure their platform accordingly.
