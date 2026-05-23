"use client";

import {
  type InfiniteData,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { reportSessionExpired } from "@/lib/api";
import { getToken } from "@/lib/tokens";
import type {
  Message,
  MessageDeletedEvent,
  MessagesPage,
  PresenceSnapshot,
  PresenceUpdate,
} from "@/lib/types";

type MessagesData = InfiniteData<MessagesPage, string | undefined>;

type ServerToClientEvents = {
  "presence:snapshot": (payload: PresenceSnapshot) => void;
  "presence:update": (payload: PresenceUpdate) => void;
  "message:created": (payload: Message) => void;
  "message:deleted": (payload: MessageDeletedEvent) => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const MESSAGES_KEY: QueryKey = ["messages"];

function getSearchTerm(key: QueryKey): string {
  return Array.isArray(key) && typeof key[1] === "string" ? key[1] : "";
}

function matchesSearch(text: string, search: string): boolean {
  const trimmed = search.trim();
  if (!trimmed) return true;
  return text.toLowerCase().includes(trimmed.toLowerCase());
}

export function useChatSocket() {
  const qc = useQueryClient();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket: Socket<ServerToClientEvents> = io(API_URL, {
      auth: { token },
      withCredentials: true,
      autoConnect: false,
    });

    const insertMessage = (msg: Message) => {
      const queries = qc.getQueriesData<MessagesData>({
        queryKey: MESSAGES_KEY,
      });
      for (const [key] of queries) {
        if (!matchesSearch(msg.text, getSearchTerm(key))) continue;
        qc.setQueryData<MessagesData>(key, (old) => {
          if (!old) return old;
          if (old.pages.some((p) => p.items.some((m) => m.id === msg.id))) {
            return old;
          }
          const [first, ...rest] = old.pages;
          if (!first) {
            return {
              ...old,
              pages: [{ items: [msg], nextCursor: null, hasMore: false }],
            };
          }
          return {
            ...old,
            pages: [{ ...first, items: [msg, ...first.items] }, ...rest],
          };
        });
      }
    };

    const removeMessage = (id: string) => {
      qc.setQueriesData<MessagesData>({ queryKey: MESSAGES_KEY }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.filter((m) => m.id !== id),
          })),
        };
      });
    };

    socket.on("connect", () => setConnected(true));

    socket.on("disconnect", (reason) => {
      setConnected(false);
      // Server force-disconnected us — usually invalid/expired JWT or
      // tokenVersion mismatch. Treat as session expiry and bounce to /sign-in.
      if (reason === "io server disconnect") {
        reportSessionExpired();
      }
    });

    socket.on("connect_error", (err: Error) => {
      setConnected(false);
      const msg = err.message?.toLowerCase() ?? "";
      if (msg.includes("auth") || msg.includes("token") || msg.includes("unauthorized")) {
        reportSessionExpired();
      }
    });

    socket.on("presence:snapshot", (payload) => {
      setOnlineUsers(new Set(payload.onlineUserIds));
    });

    socket.on("presence:update", ({ userId, isOnline }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    socket.on("message:created", insertMessage);
    socket.on("message:deleted", ({ id }) => removeMessage(id));

    // After a real reconnect (not the initial connect), we may have missed
    // creates/deletes while offline — refetch to reconcile.
    socket.io.on("reconnect", () => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.io.removeAllListeners("reconnect");
      socket.disconnect();
    };
  }, [qc]);

  return { onlineUsers, connected };
}
