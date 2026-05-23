export type User = {
  id: string;
  email: string;
  name?: string;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
};

export type Me = {
  userId: string;
  email: string;
};

export type MessageAuthor = {
  id: string;
  name: string | null;
  isOnline?: boolean;
};

export type Message = {
  id: string;
  text: string;
  createdAt: string;
  user: MessageAuthor;
};

export type MessagesPage = {
  items: Message[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type PresenceSnapshot = { onlineUserIds: string[] };
export type PresenceUpdate = { userId: string; isOnline: boolean };
export type MessageCreatedEvent = Message;
export type MessageDeletedEvent = { id: string };
