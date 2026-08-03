import { describe, expect, it } from "vitest";
import { isSafeDestination, SafeDestinationResolver } from "../../src/security/destination.js";
import { placeholderDeepLink } from "../fixtures/offers.js";

describe("destination security", () => {
  it("accepts HTTPS", () =>
    expect(isSafeDestination("https://tv.apple.com/show/example")).toBe(true));
  it.each([
    "javascript:alert(1)",
    "http://example.com",
    "https://localhost/title",
    "https://127.0.0.1/title",
    "https://[::1]/title",
    "https://[::ffff:127.0.0.1]/title",
    "https://10.0.0.1/title",
    "not a url",
    "https://user:pass@example.com/title",
    "https://metadata.google.internal/latest",
    "https://google.com/url?q=x",
    placeholderDeepLink,
  ])("rejects %s", (url) => expect(isSafeDestination(url)).toBe(false));
  it("prefers Android TV, then Android, then web", () =>
    expect(
      new SafeDestinationResolver().resolve({
        web: "https://example.com/web",
        android: "https://example.com/android",
        android_tv: "https://example.com/tv",
      })?.kind,
    ).toBe("android_tv"));
  it("rejects unverified application schemes", () =>
    expect(isSafeDestination("netflix://title/123")).toBe(false));
});
