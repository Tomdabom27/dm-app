-- ─────────────────────────────────────────────────────────────────────────────
-- DM App – Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  created_at  timestamptz not null default now()
);

-- Index for fast user lookups
create index if not exists profiles_username_idx on public.profiles(username);

-- RLS
alter table public.profiles enable row level security;

-- Anyone signed in can read all profiles (needed to show user list)
create policy "profiles: authenticated read"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only insert/update their own profile
create policy "profiles: own insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles: own update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());


-- ── 2. conversations ─────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user1_id    uuid not null references public.profiles(id) on delete cascade,
  user2_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),

  -- Enforce exactly one conversation per pair; user1_id < user2_id (lexicographic)
  constraint conversations_sorted_pair check (user1_id < user2_id),
  constraint conversations_unique_pair unique (user1_id, user2_id)
);

-- Indexes for fast lookup by either participant
create index if not exists conversations_user1_idx on public.conversations(user1_id);
create index if not exists conversations_user2_idx on public.conversations(user2_id);

-- RLS
alter table public.conversations enable row level security;

-- Users can only see conversations they are part of
create policy "conversations: participant read"
  on public.conversations for select
  to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid());

-- Users can create conversations where they are one of the two participants
create policy "conversations: participant insert"
  on public.conversations for insert
  to authenticated
  with check (user1_id = auth.uid() or user2_id = auth.uid());


-- ── 3. messages ──────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  content          text not null check (length(trim(content)) > 0),
  created_at       timestamptz not null default now()
);

-- Index for efficient polling: fetch messages after a timestamp for a conversation
create index if not exists messages_conv_time_idx
  on public.messages(conversation_id, created_at asc);

-- RLS
alter table public.messages enable row level security;

-- Users can only read messages in conversations they belong to
create policy "messages: participant read"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- Users can only insert messages as themselves, in conversations they belong to
create policy "messages: own insert"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );


-- ── 4. Realtime publication (optional but recommended) ───────────────────────
-- Enable realtime for the messages table so the primary transport works.
-- Even if realtime is blocked on the client network, this doesn't break anything.
-- The app falls back to polling automatically.

-- If you haven't already enabled realtime for this table, run:
--   alter publication supabase_realtime add table public.messages;
-- (Supabase dashboard: Database → Replication → supabase_realtime → tables)

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Next steps:
--   1. Enable "Email" auth provider in Supabase Dashboard → Authentication → Providers
--   2. Optionally disable email confirmation for dev: Authentication → Settings → "Confirm email"
--   3. Add messages table to supabase_realtime publication (see above)
-- ─────────────────────────────────────────────────────────────────────────────
