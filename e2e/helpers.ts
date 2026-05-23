import type { BrowserContext, Page, Route } from "@playwright/test";

export const API_URL = "http://localhost:3001";

export type MockUser = {
  userId: string;
  email: string;
};

export const DEFAULT_USER: MockUser = {
  userId: "user-1",
  email: "alice@example.com",
};

export const EMPTY_MESSAGES_PAGE = {
  items: [],
  nextCursor: null,
  hasMore: false,
};

type MockOptions = {
  user?: MockUser;
  loginStatus?: number;
  loginBody?: unknown;
  messagesGet?: unknown;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

/**
 * Wires up `page.route()` handlers for every REST endpoint the chat hits, plus
 * blocks the socket.io polling/upgrade requests so they don't keep the page
 * loading for tens of seconds. Each test gets a clean origin (no cached token).
 */
export async function mockBackend(
  page: Page,
  options: MockOptions = {},
): Promise<void> {
  const user = options.user ?? DEFAULT_USER;

  await page.route(`${API_URL}/auth/login`, (route: Route) =>
    fulfillJson(route, {
      status: options.loginStatus ?? 200,
      body:
        options.loginBody ??
        ({
          user: { id: user.userId, email: user.email },
          accessToken: "test-access-token",
        } as unknown),
    }),
  );

  // /auth/me mirrors the real backend: only authorised callers get 200.
  // Without this, AuthLayout's useMe() would resolve to "logged in" even
  // before the test fills the sign-in form, and would yank the user
  // straight to /messages.
  await page.route(`${API_URL}/auth/me`, (route: Route) => {
    if (route.request().method() === "OPTIONS") return respondPreflight(route);
    const auth = route.request().headers()["authorization"];
    if (!auth) {
      return fulfillJson(route, {
        status: 401,
        body: { message: "Unauthorized" },
      });
    }
    return fulfillJson(route, { status: 200, body: user });
  });

  // /messages with any querystring and DELETE /messages/:id.
  await page.route(/localhost:3001\/messages(\?|\/|$)/, (route: Route) => {
    const method = route.request().method();
    if (method === "OPTIONS") return respondPreflight(route);
    if (method === "GET") {
      return fulfillJson(route, {
        status: 200,
        body: options.messagesGet ?? EMPTY_MESSAGES_PAGE,
      });
    }
    if (method === "DELETE") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
    }
    return fulfillJson(route, {
      status: 201,
      body: {
        id: "srv-id",
        text: "x",
        createdAt: new Date().toISOString(),
        user: { id: user.userId, name: user.email, isOnline: true },
      },
    });
  });

  // socket.io — short-circuit so the page doesn't wait on retries.
  await page.route(/localhost:3001\/socket\.io/, (route: Route) =>
    route.abort(),
  );
}

async function fulfillJson(
  route: Route,
  { status, body }: { status: number; body: unknown },
) {
  // Cross-origin requests with an Authorization header trigger an OPTIONS
  // preflight. Returning the JSON body for OPTIONS makes the browser treat
  // the preflight as failed (no required CORS headers) and the real request
  // is never sent.
  if (route.request().method() === "OPTIONS") {
    return respondPreflight(route);
  }
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

async function respondPreflight(route: Route) {
  await route.fulfill({
    status: 204,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "600" },
    body: "",
  });
}

/**
 * Pre-seeds an auth token in localStorage so a test can start already
 * "logged in". Use before navigating to a protected route.
 */
export async function seedAuth(
  context: BrowserContext,
  token = "test-access-token",
): Promise<void> {
  await context.addInitScript((value: string) => {
    window.localStorage.setItem("accessToken", value);
  }, token);
}
