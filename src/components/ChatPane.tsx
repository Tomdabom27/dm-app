import { useEffect, useRef, useState } from "react";
import { Message, Profile } from "../types";
import { StatusBar } from "./StatusBar";
import { ConnectionStatus } from "../types";

interface ChatPaneProps {
  messages: Message[];
  status: ConnectionStatus;
  loading: boolean;
  myId: string;
  otherUser: Profile;
  onSend: (content: string) => Promise<boolean>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) return "Today";
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function getDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const SEND_TIMEOUT_MS = 8000;

export function ChatPane({
  messages,
  status,
  loading,
  myId,
  otherUser,
  onSend,
}: ChatPaneProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (overrideText?: string) => {
    const trimmed = (overrideText ?? text).trim();
    if (!trimmed || sending) return;

    setSending(true);
    setSendError(null);
    setFailedText(null);
    setText("");

    try {
      const result = await Promise.race([
        onSend(trimmed),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), SEND_TIMEOUT_MS),
        ),
      ]);

      if (!result) {
        setFailedText(trimmed);
        setSendError("Failed to send. Tap to retry.");
      }
    } catch {
      setFailedText(trimmed);
      setSendError("Timed out. Tap to retry.");
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleRetry = () => {
    if (!failedText) return;
    const t = failedText;
    setFailedText(null);
    setSendError(null);
    setText("");
    handleSend(t);
  };

  // Group messages by day
  const seenDays = new Set<string>();
  const renderedMessages = messages.map((msg) => {
    const dayKey = getDayKey(msg.created_at);
    const showDate = !seenDays.has(dayKey);
    seenDays.add(dayKey);
    return { msg, showDate, dayKey };
  });

  return (
    <div className="chat-pane">
      <div className="chat-header">
        <span className="chat-with">
          <span className="user-avatar sm">
            {otherUser.username[0].toUpperCase()}
          </span>
          {otherUser.username}
        </span>
        <StatusBar status={status} />
      </div>

      <div className="chat-messages">
        {loading && <div className="loading-hint">Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div className="empty-hint">No messages yet. Say hello!</div>
        )}
        {renderedMessages.map(({ msg, showDate }) => {
          const mine = msg.sender_id === myId;
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="date-divider">
                  <span>{formatDateLabel(msg.created_at)}</span>
                </div>
              )}
              <div className={`msg-row ${mine ? "mine" : "theirs"}`}>
                <div className="msg-bubble">
                  <span className="msg-text">{msg.content}</span>
                  <span className="msg-time">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && (
        <button className="send-error-banner" onClick={handleRetry}>
          ⚠ {sendError}
        </button>
      )}

      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder={`Message ${otherUser.username}…`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSendError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={sending}
          autoFocus
        />
        <button
          className="send-btn"
          onClick={() => handleSend()}
          disabled={!text.trim() || sending}
        >
          {sending ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
