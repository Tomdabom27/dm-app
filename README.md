# DM App

A minimal browser-based direct messaging app built for maximum network compatibility.
Works on restrictive Wi-Fi (schools, cafés, Linewize-filtered networks) by automatically
falling back from WebSocket realtime to HTTP polling.

## Network Reliability

| Condition | Behavior |
|-----------|----------|
| Normal network | Supabase Realtime (WebSocket on port 443) |
| WebSocket blocked | Auto-fallback to HTTP polling every 4 seconds |
| Reconnect | Attempts realtime again on page reload |

All traffic uses standard HTTPS on port 443. No custom ports, no P2P, no UDP.

---

## Setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `supabase-schema.sql`
3. Go to **Authentication → Providers** → enable **Email**
4. (For dev) Go to **Authentication → Settings** → disable "Confirm email"
5. Go to **Database → Replication → supabase_realtime** → add the `messages` table
6. Copy your **Project URL** and **anon public key** from **Project Settings → API**

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your URL and anon key
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:5173

### 4. Build for production / GitHub Pages

```bash
npm run build
# Upload the contents of /dist to GitHub Pages
```

For GitHub Pages, set the repo to serve from the `dist` folder or `gh-pages` branch.
The `base: './'` in `vite.config.ts` ensures assets load correctly from a subdirectory.

---

## Project Structure

```
src/
  lib/
    supabase.ts      — Supabase client (configured for HTTPS port 443)
    transport.ts     — ★ Core transport layer (realtime + polling fallback)
    db.ts            — All database query helpers
  hooks/
    useAuth.ts       — Authentication state and actions
    useMessages.ts   — Wraps transport for React components
  components/
    AuthForm.tsx     — Sign in / sign up form
    ChatPane.tsx     — Message thread + input
    UserList.tsx     — Sidebar user list
    StatusBar.tsx    — Connection status indicator
  App.tsx            — Top-level layout and state
  index.css          — All styles (no external CSS framework)
```

## Transport Layer (`src/lib/transport.ts`)

The `MessageTransport` class handles all connectivity:

1. **Start**: Tries Supabase Realtime (WebSocket over wss:// port 443)
2. **Timeout**: If not connected within 8 seconds → starts HTTP polling
3. **Error/disconnect**: Any channel error → falls back to polling
4. **Polling**: Fetches only messages newer than `lastTimestamp`, every 4 seconds
5. **Deduplication**: Messages are deduplicated by ID in `useMessages.ts`

Connection status displayed in the chat header:
- `● live` — WebSocket realtime active
- `◌ polling` — HTTP polling fallback active  
- `○ connecting` — Attempting connection
- `✕ offline` — No connection (polling errors)

## Database Design

Three tables with RLS enforced at the Postgres level:

- **profiles** — one row per user, username, linked to `auth.users`
- **conversations** — one row per pair; `user1_id < user2_id` (lexicographic sort) prevents duplicates
- **messages** — indexed on `(conversation_id, created_at)` for efficient incremental polling

RLS policies ensure:
- Users only see conversations they belong to
- Users only read messages in their conversations
- Users only send messages as themselves
