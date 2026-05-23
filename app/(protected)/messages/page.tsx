"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
} from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/useAuth";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ApiError } from "@/lib/api";
import { formatMessageTime, formatMessageTimeFull } from "@/lib/format";
import { deleteMessage, getMessages, sendMessage } from "@/lib/messages";
import type { Message, MessagesPage } from "@/lib/types";
import {
  sendMessageSchema,
  type SendMessageValues,
} from "@/lib/validators";

type MessagesData = InfiniteData<MessagesPage, string | undefined>;

export default function MessagesPage() {
  const me = useMe();
  const { onlineUsers, connected } = useChatSocket();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const queryKey = useMemo(
    () => ["messages", debouncedSearch] as const,
    [debouncedSearch],
  );

  const {
    data,
    isPending,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    MessagesPage,
    ApiError,
    MessagesData,
    typeof queryKey,
    string | undefined
  >({
    queryKey,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      getMessages({
        cursor: pageParam,
        limit: 20,
        search: debouncedSearch,
      }),
    getNextPageParam: (last) =>
      last.hasMore && last.nextCursor ? last.nextCursor : undefined,
  });

  // Backend returns DESC (newest first per page). Flatten and reverse so
  // oldest is at the top of the list, newest at the bottom — classic chat layout.
  const messages = useMemo<Message[]>(
    () => (data ? data.pages.flatMap((p) => p.items).slice().reverse() : []),
    [data],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const lastPagesLenRef = useRef(0);
  const wasAtBottomRef = useRef(true);

  // Reset bookkeeping when the active query changes (e.g. search input changed).
  useEffect(() => {
    lastPagesLenRef.current = 0;
    wasAtBottomRef.current = true;
  }, [queryKey]);

  // Track whether the user is currently scrolled to the bottom. We capture
  // this BEFORE data updates so that on a live insert we know if they were
  // following along or scrolled up reading older messages.
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const onScroll = () => {
      const threshold = 100;
      wasAtBottomRef.current =
        node.scrollHeight - node.scrollTop - node.clientHeight < threshold;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  // After data updates: keep scroll anchored when older pages prepend,
  // scroll to bottom on first page load, and follow new messages live
  // when the user is already at the bottom.
  useEffect(() => {
    const node = listRef.current;
    if (!node || !data) return;
    const pagesLen = data.pages.length;
    if (pagesLen > lastPagesLenRef.current && lastPagesLenRef.current > 0) {
      const delta = node.scrollHeight - prevScrollHeightRef.current;
      node.scrollTop = delta;
    } else if (pagesLen === 1 && lastPagesLenRef.current === 0) {
      node.scrollTop = node.scrollHeight;
      wasAtBottomRef.current = true;
    } else if (wasAtBottomRef.current) {
      node.scrollTop = node.scrollHeight;
    }
    lastPagesLenRef.current = pagesLen;
  }, [data]);

  // IntersectionObserver on the top sentinel triggers fetchNextPage.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;
    if (!hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          prevScrollHeightRef.current = root.scrollHeight;
          fetchNextPage();
        }
      },
      { root, rootMargin: "100px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sendForm = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { text: "" },
  });

  // No optimistic insertion — we wait for `message:created` over the socket
  // to update the cache. Both our own and others' messages flow through the
  // same path, which avoids dedup races against the broadcast.
  const sendMutation = useMutation<Message, ApiError, string>({
    mutationFn: (text) => sendMessage(text),
    onError: (err) => {
      toast.error(err.message || "Couldn't send message");
    },
  });

  // Delete is purely server-driven for the same reason: the `message:deleted`
  // broadcast (which we receive too) removes the row from the cache.
  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: (id) => deleteMessage(id),
    onError: (err) => {
      if (err.status === 403) {
        toast.error("You can only delete your own messages");
      } else if (err.status === 404) {
        toast.error("Message no longer exists");
      } else {
        toast.error(err.message || "Couldn't delete message");
      }
    },
  });

  const onSubmit = sendForm.handleSubmit((values) => {
    const text = values.text.trim();
    if (!text) return;
    sendMutation.mutate(text);
    sendForm.reset({ text: "" });
  });

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Input
          type="search"
          placeholder="Search messages…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-10 text-[15px]"
        />
        {!connected && (
          <span className="shrink-0 text-xs text-muted-foreground">
            Reconnecting…
          </span>
        )}
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {hasNextPage && (
          <div ref={sentinelRef} className="flex justify-center py-2">
            {isFetchingNextPage && (
              <span className="text-xs text-muted-foreground">Loading older…</span>
            )}
          </div>
        )}

        {isPending && (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">
            Loading messages…
          </div>
        )}

        {isError && !isPending && (
          <div className="flex justify-center py-8 text-sm text-destructive">
            {error?.message || "Failed to load messages"}
          </div>
        )}

        {!isPending && messages.length === 0 && !isError && (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">
            {debouncedSearch
              ? `No messages match "${debouncedSearch}"`
              : "No messages yet. Be the first to say hi."}
          </div>
        )}

        <ul className="flex flex-col gap-4">
          {messages.map((m) => {
            const isOwn = me.data && m.user.id === me.data.userId;
            const isOnline = onlineUsers.has(m.user.id);
            const isDeleting =
              deleteMutation.isPending && deleteMutation.variables === m.id;
            return (
              <li
                key={m.id}
                className={`group flex flex-col gap-1 ${
                  isOwn ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`relative max-w-[80%] rounded-2xl px-4 py-2.5 text-[16px] leading-relaxed shadow-sm ${
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div
                    className="mb-1 flex items-center gap-2 text-xs font-medium opacity-70"
                    title={formatMessageTimeFull(m.createdAt)}
                  >
                    <span
                      aria-label={isOnline ? "online" : "offline"}
                      title={isOnline ? "Online" : "Offline"}
                      className={`inline-block h-2 w-2 rounded-full ${
                        isOnline
                          ? "bg-emerald-500"
                          : "bg-zinc-400 dark:bg-zinc-500"
                      }`}
                    />
                    <span>
                      {m.user.name || "Anonymous"} ·{" "}
                      {formatMessageTime(m.createdAt)}
                    </span>
                    {isOwn && (
                      <button
                        type="button"
                        aria-label="Delete message"
                        onClick={() => deleteMutation.mutate(m.id)}
                        disabled={isDeleting}
                        className="ml-1 rounded p-1 text-inherit opacity-0 transition-opacity hover:bg-white/15 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t p-4"
      >
        <textarea
          {...sendForm.register("text")}
          onKeyDown={onTextareaKeyDown}
          rows={2}
          placeholder="Type a message — Enter to send, Shift+Enter for new line"
          className="flex-1 resize-none rounded-xl border border-input bg-transparent px-4 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          disabled={sendMutation.isPending}
        />
        <Button
          type="submit"
          disabled={sendMutation.isPending}
          size="lg"
          className="h-11 px-5"
        >
          {sendMutation.isPending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
