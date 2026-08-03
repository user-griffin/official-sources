import type { AppEnv } from "../config/env.js";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
function shell(title: string, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/assets/styles.css"></head><body><header><a class="brand" href="/">OFFICIAL SOURCES</a><nav><a href="/configure">Configure</a><a href="/manifest.json">Manifest</a><a href="/health">Health</a></nav></header><main>${content}</main><footer>Availability data by <a href="https://www.watchmode.com/" rel="noopener">Watchmode</a>. Independent and unofficial.</footer></body></html>`;
}

export function landingPage(env: AppEnv): string {
  const repository = env.GITHUB_REPOSITORY_URL
    ? `<a class="button secondary" href="${escapeHtml(env.GITHUB_REPOSITORY_URL)}" rel="noopener">Repository</a>`
    : "";
  return shell(
    "Official Sources",
    `<section class="hero"><p class="eyebrow">A LEGITIMATE SOURCE LAYER</p><h1>Your subscriptions, right beside every other source.</h1><p>Official Sources is a Stremio-compatible addon built primarily for Nuvio TV. It returns links to exact titles or episodes in official provider apps and websites.</p><div class="actions"><a class="button" href="/configure">Configure services</a><a class="button secondary" href="/manifest.json">View manifest</a>${repository}</div></section><section class="grid"><article><h2>What it does</h2><p>Filters and ranks provider availability for your region and subscriptions, then opens the official destination with an Android browsable intent.</p></article><article><h2>What it never does</h2><p>It never plays, downloads, proxies, decrypts, or redistributes video. It never receives provider usernames, passwords, cookies, tokens, DRM licenses, manifests, streams, or viewing history.</p></article><article><h2>What you control</h2><p>Choose services, offer types, fallback behavior, and provider priority. Your non-sensitive settings are encoded in the installation URL—there are no user accounts.</p></article></section><section class="notice"><h2>Deep-link reality</h2><p>Platform-specific deep links may require a paid Watchmode plan. Valid HTTPS links can still open installed apps through Android App Links, but provider behavior and exact episode navigation vary. Authentication, subscription checks, DRM, and playback remain inside the provider app or website.</p></section><p class="disclaimer">Official Sources is an independent, unofficial project and is not affiliated with Nuvio, Stremio, Watchmode, or any streaming provider.</p>`,
  );
}

const option = (name: string, label: string, checked: boolean) =>
  `<label class="toggle"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span>${label}</span></label>`;

export function configurePage(): string {
  return shell(
    "Configure · Official Sources",
    `<section class="page-heading"><p class="eyebrow">CONFIGURE</p><h1>Build your source lineup</h1><p>Select your region and subscriptions. No provider credentials are requested or stored.</p></section><form id="config-form"><section class="panel"><h2>Region</h2><label for="country">Two-letter country code</label><input id="country" name="country" value="US" maxlength="2" pattern="[A-Za-z]{2}" required><p class="help">Watchmode plan availability varies by country.</p></section><section class="panel"><div class="panel-head"><div><h2>Your services</h2><p class="help">Provider data loads from the backend. Logos remain hosted by their source.</p></div><input id="provider-search" type="search" placeholder="Search providers" aria-label="Search providers"></div><div class="actions compact"><button type="button" id="select-visible" class="small">Select visible</button><button type="button" id="clear-selected" class="small secondary">Clear selected</button></div><div id="provider-status" role="status">Loading providers…</div><ol id="providers" class="providers" aria-label="Provider priority"></ol></section><section class="panel"><h2>Offer types</h2><div class="toggle-grid">${option("showSubscription", "Subscription", true)}${option("showFree", "Free", true)}${option("showAds", "Free with ads", true)}${option("showTvEverywhere", "TV Everywhere", false)}${option("showRent", "Rentals", false)}${option("showPurchase", "Purchases", false)}</div></section><section class="panel"><h2>Behavior</h2><div class="toggle-grid">${option("selectedFirst", "Selected services first", true)}${option("showUnselected", "Show unselected services", false)}${option("hideInvalidLinks", "Hide invalid links", true)}${option("collapseDuplicates", "Collapse duplicate offers", true)}${option("allowSeriesFallback", "Permit series-page fallback", true)}${option("showSeriesFallback", "Display labeled fallback results", true)}${option("showPrices", "Display prices", true)}</div></section><section class="panel result-panel"><h2>Install</h2><p id="validation" class="validation" role="alert"></p><label for="manifest-url">Configured manifest URL</label><input id="manifest-url" readonly><div class="actions compact"><button type="button" id="copy-manifest">Copy manifest URL</button><a id="install-link" class="button" href="#">Install / open</a></div><p class="help">In Nuvio, install the generated URL, then open the installed addon list and move Official Sources to the top. Nuvio controls order between addon groups.</p></section></form><section class="notice"><p>Exact Android TV and episode links depend on your Watchmode plan and provider support. HTTPS destinations may open the installed app through Android App Links. The provider app handles sign-in and playback.</p><p>Availability data by <a href="https://www.watchmode.com/" rel="noopener">Watchmode</a>.</p></section><script src="/assets/configure.js" defer></script>`,
  );
}
