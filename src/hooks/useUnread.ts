/**
 * useUnread.ts
 * Tracks unread message counts per conversation, exposed as userId -> count
 * so the UserList can show per-user badges.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const POLL_MS = 5000;
const STORAGE_KEY = "dm_last_seen";

function loadLastSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveLastSeen(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

interface ConvInfo {
  id: string;
  user1_id: string;
  user2_id: string;
}

export function useUnread(userId: string | null) {
  // userId of the other person -> unread count
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  // conversationId -> unread count (for markRead)
  const convMapRef = useRef<ConvInfo[]>([]);
  const lastSeenRef = useRef<Record<string, string>>(loadLastSeen());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnread = useCallback(async () => {
    if (!userId) return;

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, user1_id, user2_id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (!convs || convs.length === 0) return;
    convMapRef.current = convs as ConvInfo[];

    const result: Record<string, number> = {};

    await Promise.all(
      (convs as ConvInfo[]).map(async (conv) => {
        const otherId =
          conv.user1_id === userId ? conv.user2_id : conv.user1_id;
        const lastSeen =
          lastSeenRef.current[conv.id] ?? new Date(0).toISOString();

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", userId)
          .gt("created_at", lastSeen);

        result[otherId] = count ?? 0;
      }),
    );

    setUnreadByUser(result);
  }, [userId]);

  // Mark a conversation as read
  const markRead = useCallback(
    (conversationId: string) => {
      const now = new Date().toISOString();
      lastSeenRef.current = { ...lastSeenRef.current, [conversationId]: now };
      saveLastSeen(lastSeenRef.current);

      // Find the other user in this conversation and zero their count
      const conv = convMapRef.current.find((c) => c.id === conversationId);
      if (conv && userId) {
        const otherId =
          conv.user1_id === userId ? conv.user2_id : conv.user1_id;
        setUnreadByUser((prev) => ({ ...prev, [otherId]: 0 }));
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setUnreadByUser({});
      return;
    }

    fetchUnread();
    timerRef.current = setInterval(fetchUnread, POLL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, fetchUnread]);

  const totalUnread = Object.values(unreadByUser).reduce((a, b) => a + b, 0);

  return { unread: unreadByUser, markRead, totalUnread };
}
