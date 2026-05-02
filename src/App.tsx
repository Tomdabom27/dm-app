import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMessages } from "./hooks/useMessages";
import { useUnread } from "./hooks/useUnread";
import { useNotifications } from "./hooks/useNotifications";
import { AuthForm } from "./components/AuthForm";
import { UserList } from "./components/UserList";
import { ChatPane } from "./components/ChatPane";
import { Profile, Conversation } from "./types";
import { getAllProfiles, getOrCreateConversation } from "./lib/db";

export default function App() {
  const {
    user,
    profile,
    loading: authLoading,
    signIn,
    signUp,
    signOut,
  } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeUser, setActiveUser] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [convLoading, setConvLoading] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  const {
    messages,
    status,
    sendMessage,
    loading: msgLoading,
  } = useMessages(conversation?.id ?? null, user?.id ?? "");

  const { unread, markRead, totalUnread } = useUnread(user?.id ?? null);
  const { notify } = useNotifications();

  // Update page title with unread badge
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) DM` : "DM";
  }, [totalUnread]);

  // Notify on new messages from others
  useEffect(() => {
    if (!messages.length || !user) return;
    const latest = messages[messages.length - 1];
    if (latest.sender_id === user.id) return;
    if (
      latest.conversation_id === conversation?.id &&
      document.visibilityState === "visible"
    )
      return;

    const sender = profiles.find((p) => p.id === latest.sender_id);
    if (sender) notify(`${sender.username}`, latest.content);
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load all profiles when authenticated
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setActiveUser(null);
      setConversation(null);
      return;
    }
    getAllProfiles().then(setProfiles);
  }, [user]);

  const handleSelectUser = useCallback(
    async (other: Profile) => {
      if (!user) return;
      setActiveUser(other);
      setConvLoading(true);
      setConversation(null);
      const conv = await getOrCreateConversation(user.id, other.id);
      setConversation(conv);
      setConvLoading(false);
      if (conv) markRead(conv.id);
    },
    [user, markRead],
  );

  // Mark as read when active conversation gets new messages and tab is visible
  useEffect(() => {
    if (conversation?.id && document.visibilityState === "visible") {
      markRead(conversation.id);
    }
  }, [messages, conversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = () => {
    if (signOutConfirm) {
      signOut();
      setSignOutConfirm(false);
    } else {
      setSignOutConfirm(true);
      setTimeout(() => setSignOutConfirm(false), 4000);
    }
  };

  if (authLoading) {
    return <div className="splash">Loading…</div>;
  }

  if (!user || !profile) {
    return <AuthForm onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <span className="my-name">{profile.username}</span>
          <button
            className={`signout-btn${signOutConfirm ? " confirm" : ""}`}
            onClick={handleSignOut}
            title={signOutConfirm ? "Click again to confirm" : "Sign out"}
          >
            {signOutConfirm ? "Sure?" : "⏻"}
          </button>
        </div>
        <UserList
          profiles={profiles}
          myId={user.id}
          activeId={activeUser?.id ?? null}
          unread={unread}
          onSelect={handleSelectUser}
        />
      </aside>

      <main className="main-area">
        {convLoading && (
          <div className="empty-state">Opening conversation…</div>
        )}
        {!convLoading && (!activeUser || !conversation) && (
          <div className="empty-state">
            <span className="empty-icon">↖</span>
            <span>Select someone to message</span>
          </div>
        )}
        {!convLoading && activeUser && conversation && (
          <ChatPane
            messages={messages}
            status={status}
            loading={msgLoading}
            myId={user.id}
            otherUser={activeUser}
            onSend={sendMessage}
          />
        )}
      </main>
    </div>
  );
}
