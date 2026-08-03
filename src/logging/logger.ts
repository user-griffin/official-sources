export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof levels;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/([?&](?:apiKey|token)=)[^&\s]+/gi, "$1[REDACTED]")
      .replace(/(X-API-Key["':=\s]+)[^\s,}]+/gi, "$1[REDACTED]")
      .replace(/\/c\/[A-Za-z0-9_-]{20,}/g, "/c/[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /key|authorization|cookie/i.test(key) || /^token$/i.test(key) ? "[REDACTED]" : redact(item),
      ]),
    );
  }
  return value;
}

export function createLogger(minLevel: Level = "info"): Logger {
  const write = (level: Level, event: string, fields: Record<string, unknown> = {}) => {
    if (levels[level] < levels[minLevel]) return;
    const line = JSON.stringify(
      redact({ timestamp: new Date().toISOString(), level, event, ...fields }),
    );
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}

export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
