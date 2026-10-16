// Chat between registered customers (Chat tab): one to one and groups, text only. The server decides who may read a
// chat, who may add people and how fast one person may send (see backend docs/API.md, "Chat").

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface ChatPerson {
  phone: string;
  name: string;
  avatar: string | null;
}

export interface ChatThreadRow {
  id: string;
  kind: "direct" | "group";
  title: string;
  avatar: string | null;
  memberCount: number;
  lastMessage: string | null;
  lastFrom: string | null;
  lastMessageAt: string;
  unread: number;
}

export interface ChatMemberInfo extends ChatPerson {
  role: "admin" | "member";
  you: boolean;
}

export interface ChatInfo {
  id: string;
  kind: "direct" | "group";
  title: string;
  avatar: string | null;
  members: ChatMemberInfo[];
  isAdmin: boolean;
  inviteCode: string | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface InvitePreview {
  id: string;
  name: string;
  memberCount: number;
  alreadyIn: boolean;
  full: boolean;
}

export const BODY_MAX = 1000;
export const GROUP_NAME_MAX = 40;
export const MIN_SEARCH_DIGITS = 5;

export const threadsStore = createRemoteStore<ChatThreadRow[]>(() => api<ChatThreadRow[]>("/chat/threads"), { pollMs: 8000, signedOut: [] });
export const unreadStore = createRemoteStore<number>(async () => (await api<{ unread: number }>("/chat/unread")).unread, { pollMs: 20000, signedOut: 0 });

export const searchPeople = (q: string) => api<ChatPerson[]>("/chat/people", { query: { q } });
export const openDirect = (phone: string) => api<{ id: string }>("/chat/direct", { method: "POST", body: { phone } });
export const createGroup = (name: string, members: string[]) => api<{ id: string }>("/chat/groups", { method: "POST", body: { name, members } });
export const loadThread = (id: string) => api<ChatInfo>(`/chat/threads/${id}`);
export const loadMessages = (id: string, after?: string) => api<ChatMessage[]>(`/chat/threads/${id}/messages`, { query: { after } });
export const sendMessage = (id: string, body: string) => api<ChatMessage>(`/chat/threads/${id}/messages`, { method: "POST", body: { body } });
export const addMembers = (id: string, phones: string[]) => api<ChatInfo>(`/chat/threads/${id}/members`, { method: "POST", body: { phones } });
export const removeMember = (id: string, phone: string) => api<{ left: boolean }>(`/chat/threads/${id}/members/${phone}`, { method: "DELETE" });
export const renameGroup = (id: string, name: string) => api<ChatInfo>(`/chat/threads/${id}`, { method: "PATCH", body: { name } });
export const resetInvite = (id: string) => api<{ inviteCode: string }>(`/chat/threads/${id}/invite`, { method: "POST" });
export const loadInvite = (code: string) => api<InvitePreview>(`/chat/invite/${encodeURIComponent(code)}`);
export const joinInvite = (code: string) => api<{ id: string }>(`/chat/invite/${encodeURIComponent(code)}/join`, { method: "POST" });

export const inviteLink = (code: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/chat/join/${code}`;

// "9:05 PM" for today, "12 Oct" for earlier days
export function chatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---- friends ----
export interface Friend extends ChatPerson {
  id: string; // the friendship, used to remove it
}
export interface FriendRequestIn {
  id: string;
  from: ChatPerson;
  at: string;
}
export interface FriendRequestOut {
  id: string;
  to: ChatPerson;
  at: string;
}
export interface FriendsOverview {
  friends: Friend[];
  incoming: FriendRequestIn[];
  outgoing: FriendRequestOut[];
}

const NO_FRIENDS: FriendsOverview = { friends: [], incoming: [], outgoing: [] };
export const friendsStore = createRemoteStore<FriendsOverview>(() => api<FriendsOverview>("/chat/friends"), { pollMs: 15000, signedOut: NO_FRIENDS });

export const sendFriendRequest = (phone: string) => api<{ id: string; status: "pending" | "accepted" }>("/chat/friends/request", { method: "POST", body: { phone } });
export const acceptFriend = (id: string) => api<{ accepted: true }>(`/chat/friends/${id}/accept`, { method: "POST" });
export const removeFriend = (id: string) => api<{ removed: true }>(`/chat/friends/${id}`, { method: "DELETE" });
