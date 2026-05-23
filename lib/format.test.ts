import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMessageTime, formatMessageTimeFull } from "./format";

// vitest.config.mts pins TZ=UTC, so date math below is deterministic.
const NOW = new Date("2026-05-23T12:00:00Z");

describe("formatMessageTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels a same-day timestamp as 'Today'", () => {
    const sameDay = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(formatMessageTime(sameDay)).toMatch(/^Today, /);
  });

  it("labels yesterday's timestamp as 'Yesterday'", () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatMessageTime(yesterday)).toMatch(/^Yesterday, /);
  });

  it("returns an empty string for an unparseable input", () => {
    expect(formatMessageTime("not-a-date")).toBe("");
  });
});

describe("formatMessageTimeFull", () => {
  it("returns a non-empty formatted string for a valid ISO timestamp", () => {
    expect(formatMessageTimeFull("2026-05-23T12:00:00Z")).not.toBe("");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatMessageTimeFull("nope")).toBe("");
  });
});
