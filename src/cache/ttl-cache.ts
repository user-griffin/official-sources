export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  getOrSet<T>(
    key: string,
    ttlMs: number | ((value: T) => number),
    operation: () => Promise<T>,
  ): Promise<T>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class MemoryTtlCache implements Cache {
  private readonly values = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.values.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.values.delete(key);
  }

  async getOrSet<T>(
    key: string,
    ttlMs: number | ((value: T) => number),
    operation: () => Promise<T>,
  ): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== undefined) return existing;
    const active = this.pending.get(key) as Promise<T> | undefined;
    if (active) return active;
    const promise = operation()
      .then((value) => {
        this.set(key, value, typeof ttlMs === "function" ? ttlMs(value) : ttlMs);
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}
