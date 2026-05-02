export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export type ConnectionStatus = 'realtime' | 'polling' | 'disconnected' | 'connecting'
