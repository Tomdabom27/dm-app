/**
 * useMessages.ts
 * React hook that wraps MessageTransport for a given conversation.
 * Handles lifecycle: start transport on mount, destroy on unmount or convo change.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Message, ConnectionStatus } from '../types'
import { MessageTransport } from '../lib/transport'
import { getMessages, sendMessage as dbSendMessage } from '../lib/db'

interface UseMessagesResult {
  messages: Message[]
  status: ConnectionStatus
  sendMessage: (content: string) => Promise<boolean>
  loading: boolean
}

export function useMessages(
  conversationId: string | null,
  myUserId: string
): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [loading, setLoading] = useState(false)
  const transportRef = useRef<MessageTransport | null>(null)

  // Load initial messages and set up transport when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setStatus('disconnected')
      return
    }

    let cancelled = false

    const init = async () => {
      setLoading(true)
      setMessages([])
      setStatus('connecting')

      const initial = await getMessages(conversationId)
      if (cancelled) return

      setMessages(initial)
      setLoading(false)

      // Determine the timestamp of the last message so polling only fetches NEW ones
      const lastTs = initial.length > 0
        ? initial[initial.length - 1].created_at
        : new Date(0).toISOString()

      // Destroy previous transport if any
      if (transportRef.current) {
        transportRef.current.destroy()
        transportRef.current = null
      }

      const transport = new MessageTransport(
        conversationId,
        lastTs,
        (newMsgs) => {
          setMessages((prev) => {
            // Deduplicate by id
            const existingIds = new Set(prev.map((m) => m.id))
            const fresh = newMsgs.filter((m) => !existingIds.has(m.id))
            return fresh.length > 0 ? [...prev, ...fresh] : prev
          })
        },
        (s) => {
          if (!cancelled) setStatus(s)
        }
      )

      transportRef.current = transport
      transport.start()
    }

    init()

    return () => {
      cancelled = true
      if (transportRef.current) {
        transportRef.current.destroy()
        transportRef.current = null
      }
    }
  }, [conversationId])

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!conversationId) return false
      const trimmed = content.trim()
      if (!trimmed) return false

      const msg = await dbSendMessage(conversationId, myUserId, trimmed)
      if (!msg) return false

      // Optimistically add to local state (dedup handles if realtime also delivers it)
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id)
        return exists ? prev : [...prev, msg]
      })

      return true
    },
    [conversationId, myUserId]
  )

  return { messages, status, sendMessage, loading }
}
