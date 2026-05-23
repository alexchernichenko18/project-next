import * as Sentry from "@sentry/nextjs";
import { clearToken, getToken } from "@/lib/tokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function emitSessionExpired() {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
    }
  }
}

export function reportSessionExpired() {
  clearToken();
  Sentry.setUser(null);
  emitSessionExpired();
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  let hadToken = false;
  if (auth) {
    const token = getToken();
    if (token) {
      hadToken = true;
      finalHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = extractMessage(payload) ?? response.statusText ?? "Request failed";
    if (response.status === 401 && auth && hadToken) {
      reportSessionExpired();
    }
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

function extractMessage(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object" && payload !== null) {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (Array.isArray(obj.message) && typeof obj.message[0] === "string") {
      return obj.message.join(", ");
    }
    if (typeof obj.error === "string") return obj.error;
  }
  return null;
}
