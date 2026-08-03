import { describe, expect, it, vi } from "vitest";
import { MemoryTtlCache } from "../../src/cache/ttl-cache.js";

describe("TTL cache", () => {
  it("expires values", () => {
    vi.useFakeTimers();
    const cache = new MemoryTtlCache();
    cache.set("x", 1, 10);
    expect(cache.get("x")).toBe(1);
    vi.advanceTimersByTime(11);
    expect(cache.get("x")).toBeUndefined();
    vi.useRealTimers();
  });
  it("deduplicates concurrent operations", async () => {
    const cache = new MemoryTtlCache();
    let calls = 0;
    const operation = async () => {
      calls += 1;
      await Promise.resolve();
      return 42;
    };
    expect(
      await Promise.all([
        cache.getOrSet("x", 1000, operation),
        cache.getOrSet("x", 1000, operation),
      ]),
    ).toEqual([42, 42]);
    expect(calls).toBe(1);
  });
});
