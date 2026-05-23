/**
 * Integration test for `useChatSocket`: exercises the real React Query cache
 * wiring and presence reducer with a controllable fake socket.io client. Only
 * `socket.io-client` and `@sentry/nextjs` are mocked.
 */

import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn() }));

type Listener = (...args: unknown[]) => void;

class FakeSocket {
  listeners = new Map<string, Set<Listener>>();
  managerListeners = new Map<string, Set<Listener>>();
  io = {
    on: (event: string, fn: Listener) => {
      const set = this.managerListeners.get(event) ?? new Set<Listener>();
      set.add(fn);
      this.managerListeners.set(event, set);
    },
    removeAllListeners: (event: string) => {
      this.managerListeners.delete(event);
    },
  };
  on(event: string, fn: Listener): void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(fn);
    this.listeners.set(event, set);
  }
  connect(): void {}
  disconnect(): void {}
  removeAllListeners(): void {
    this.listeners.clear();
  }
  trigger(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }
}

let currentSocket: FakeSocket | undefined;

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    currentSocket = new FakeSocket();
    return currentSocket;
  }),
}));

import { setToken } from "@/lib/tokens";
import type { Message, MessagesPage } from "@/lib/types";
import { useChatSocket } from "./useChatSocket";

type MessagesData = InfiniteData<MessagesPage, string | undefined>;

const MESSAGE_ALPHA: Message = {
  id: "m-alpha",
  text: "hello",
  createdAt: "2026-05-23T10:00:00Z",
  user: { id: "u-1", name: "Alice" },
};

const MESSAGE_BETA: Message = {
  id: "m-beta",
  text: "world",
  createdAt: "2026-05-23T10:01:00Z",
  user: { id: "u-2", name: "Bob" },
};

function setup(seed?: MessagesData) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (seed) {
    qc.setQueryData(["messages", ""], seed);
  }
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useChatSocket(), { wrapper });
  const socket = currentSocket;
  if (!socket) throw new Error("Fake socket was not constructed");
  return { qc, socket, ...view };
}

function pageWith(items: Message[]): MessagesData {
  return {
    pages: [{ items, nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  };
}

beforeEach(() => {
  setToken("test-token");
  currentSocket = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useChatSocket presence", () => {
  it("replaces the online set on presence:snapshot and patches it on update", () => {
    const { socket, result } = setup();

    act(() => {
      socket.trigger("presence:snapshot", { onlineUserIds: ["u-1", "u-2"] });
    });
    expect(result.current.onlineUsers).toEqual(new Set(["u-1", "u-2"]));

    act(() => {
      socket.trigger("presence:update", { userId: "u-3", isOnline: true });
    });
    expect(result.current.onlineUsers).toEqual(
      new Set(["u-1", "u-2", "u-3"]),
    );

    act(() => {
      socket.trigger("presence:update", { userId: "u-1", isOnline: false });
    });
    expect(result.current.onlineUsers).toEqual(new Set(["u-2", "u-3"]));
  });
});

describe("useChatSocket message:created", () => {
  it("prepends the new message to the first page of the cache", () => {
    const { qc, socket } = setup(pageWith([MESSAGE_ALPHA]));

    act(() => {
      socket.trigger("message:created", MESSAGE_BETA);
    });

    const data = qc.getQueryData<MessagesData>(["messages", ""]);
    expect(data?.pages[0].items.map((m) => m.id)).toEqual([
      MESSAGE_BETA.id,
      MESSAGE_ALPHA.id,
    ]);
  });

  it("dedupes by id so the same broadcast is not inserted twice", () => {
    const { qc, socket } = setup(pageWith([MESSAGE_ALPHA]));

    act(() => {
      socket.trigger("message:created", MESSAGE_ALPHA);
    });

    const data = qc.getQueryData<MessagesData>(["messages", ""]);
    expect(data?.pages[0].items).toHaveLength(1);
  });

  it("skips inserts that do not match an active search query", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(["messages", "world"], pageWith([]));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    renderHook(() => useChatSocket(), { wrapper });
    const socket = currentSocket!;

    act(() => {
      socket.trigger("message:created", {
        ...MESSAGE_ALPHA,
        text: "completely unrelated",
      });
    });

    const data = qc.getQueryData<MessagesData>(["messages", "world"]);
    expect(data?.pages[0].items).toHaveLength(0);
  });
});

describe("useChatSocket message:deleted", () => {
  it("removes the message from every cached page", () => {
    const { qc, socket } = setup(pageWith([MESSAGE_ALPHA, MESSAGE_BETA]));

    act(() => {
      socket.trigger("message:deleted", { id: MESSAGE_ALPHA.id });
    });

    const data = qc.getQueryData<MessagesData>(["messages", ""]);
    expect(data?.pages[0].items.map((m) => m.id)).toEqual([MESSAGE_BETA.id]);
  });

  it("is a no-op for an unknown id", () => {
    const { qc, socket } = setup(pageWith([MESSAGE_ALPHA]));

    act(() => {
      socket.trigger("message:deleted", { id: "does-not-exist" });
    });

    const data = qc.getQueryData<MessagesData>(["messages", ""]);
    expect(data?.pages[0].items).toHaveLength(1);
  });
});
