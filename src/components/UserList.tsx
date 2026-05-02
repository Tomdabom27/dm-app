import { Profile } from "../types";

interface UserListProps {
  profiles: Profile[];
  myId: string;
  activeId: string | null;
  unread: Record<string, number>;
  onSelect: (profile: Profile) => void;
}

export function UserList({
  profiles,
  myId,
  activeId,
  unread,
  onSelect,
}: UserListProps) {
  const others = profiles.filter((p) => p.id !== myId);

  // Total unread per user — we don't have conversationId→userId map here,
  // so we sum all unread values and match by passing unread keyed by conversationId.
  // The parent passes the full unread map; UserList just shows a dot if any > 0.
  // For per-user indicators we need conversationId, which App passes via unread map.
  // We show a badge on the user if any conversation with them has unread > 0.
  // Since unread is keyed by conversationId (not userId), we show total badge on sidebar top.
  // For per-user we need the conversationId — we receive it as unread prop keyed by convId.
  // We'll accept an optional unreadByUserId map too.

  return (
    <div className="user-list">
      <div className="panel-header">People</div>
      {others.length === 0 && (
        <div className="empty-hint">No other users yet</div>
      )}
      {others.map((p) => {
        // unread is keyed by conversationId but we don't have it here per-user.
        // We pass unread as-is and check if any value > 0 for this profile by
        // having App compute unreadByUserId before passing down.
        const count = unread[p.id] ?? 0;
        return (
          <button
            key={p.id}
            className={`user-item${activeId === p.id ? " active" : ""}`}
            onClick={() => onSelect(p)}
          >
            <span className="user-avatar">{p.username[0].toUpperCase()}</span>
            <span className="user-name">{p.username}</span>
            {count > 0 && (
              <span className="unread-badge">{count > 99 ? "99+" : count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
