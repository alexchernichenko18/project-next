/**
 * Integration test for `apiFetch`: exercises the real auth-header wiring,
 * token storage and the session-expired listener fan-out. Only `fetch` and
 * `@sentry/nextjs` are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  setUser: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { ApiError, apiFetch, onSessionExpired } from "./api";
import { clearToken, getToken, setToken } from "./tokens";

const sentrySetUser = Sentry.setUser as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  clearToken();
  sentrySetUser.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiFetch happy path", () => {
  it("attaches Bearer token and parses the JSON response", async () => {
    setToken("token-123");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true, value: 42 }));

    const result = await apiFetch<{ ok: boolean; value: number }>("/things");

    expect(result).toEqual({ ok: true, value: 42 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3001/things");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
  });

  it("serializes a JSON body and sets Content-Type", async () => {
    setToken("token-123");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: "m-1" }));

    await apiFetch("/messages", {
      method: "POST",
      body: { text: "hi" },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ text: "hi" }));
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});

describe("apiFetch 401 path", () => {
  it("clears the token, resets the Sentry user, and notifies listeners", async () => {
    setToken("expired");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(apiFetch("/auth/me")).rejects.toBeInstanceOf(ApiError);

    expect(getToken()).toBeNull();
    expect(sentrySetUser).toHaveBeenCalledTimes(1);
    expect(sentrySetUser).toHaveBeenCalledWith(null);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("does NOT trigger session-expired when the request was unauthenticated", async () => {
    // No token set ⇒ no Authorization header sent ⇒ 401 must NOT log the user
    // out (e.g. /auth/login itself returning 401 for bad creds).
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(
      apiFetch("/auth/login", {
        method: "POST",
        body: { email: "x@y.z", password: "bad" },
        auth: false,
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(listener).not.toHaveBeenCalled();
    expect(sentrySetUser).not.toHaveBeenCalled();

    unsubscribe();
  });
});
