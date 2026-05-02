/**
 * db.ts
 * All Supabase database operations in one place.
 * All requests go through the Supabase REST API over HTTPS port 443.
 */

import { supabase } from './supabase'
import { Profile, Conversation, Message } from '../types'

/** Sorted pair to ensure consistent user1_id < user2_id ordering */
function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as Profile
}

export async function createProfile(userId: string, username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username })
    .select()
    .single()
  if (error) {
    console.error('createProfile error:', error)
    return null
  }
  return data as Profile
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('username', { ascending: true })
  if (error) return []
  return (data as Profile[]) ?? []
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  myId: string,
  otherId: string
): Promise<Conversation | null> {
  const [u1, u2] = sortedPair(myId, otherId)

  // Try to find existing conversation
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .maybeSingle()

  if (findError) {
    console.error('getOrCreateConversation find error:', findError)
    return null
  }
  if (existing) return existing as Conversation

  // Create new conversation
  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ user1_id: u1, user2_id: u2 })
    .select()
    .single()

  if (createError) {
    console.error('getOrCreateConversation create error:', createError)
    return null
  }
  return created as Conversation
}

export async function getMyConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data as Conversation[]) ?? []
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return ((data as Message[]) ?? []).reverse()
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select()
    .single()
  if (error) {
    console.error('sendMessage error:', error)
    return null
  }
  return data as Message
}
