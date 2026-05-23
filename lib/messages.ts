import { apiFetch } from "@/lib/api";
import type { Message, MessagesPage } from "@/lib/types";

export type GetMessagesParams = {
  cursor?: string;
  limit?: number;
  search?: string;
};

export function getMessages(params: GetMessagesParams): Promise<MessagesPage> {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 20));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.search && params.search.trim()) {
    search.set("search", params.search.trim());
  }
  return apiFetch<MessagesPage>(`/messages?${search.toString()}`);
}

export function sendMessage(text: string): Promise<Message> {
  return apiFetch<Message>("/messages", {
    method: "POST",
    body: { text },
  });
}

export function deleteMessage(id: string): Promise<void> {
  return apiFetch<void>(`/messages/${id}`, { method: "DELETE" });
}
