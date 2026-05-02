/**
 * transport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Resilient message transport for restrictive networks.
 *
 * Strategy:
 *   1. Attempt Supabase Realtime (WebSocket over port 443 / wss://)
 *   2. On failure / disconnect → fall back to HTTP polling every POLL_INTERVAL ms
 *   3. Expose a unified subscribe/unsubscribe API that callers don't need to
 *      change regardless of which transport is active.
 *
 * All network requests go through standard HTTPS on port 443.
 * No custom ports, no P2P, no UDP.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { Message, ConnectionStatus } from '../types'

const POLL_INTERVAL_MS = 4000       // poll every 4 seconds when in fallback
const REALTIME_TIMEOUT_MS = 8000    // give realtime 8s to connect before falling back

export type MessageCallback = (messages: Message[]) => void
export type StatusCallback = (status: ConnectionStatus) => void

export class MessageTransport {
  private conversationId: string
  private lastTimestamp: string
  private onMessage: MessageCallback
  private onStatusChange: StatusCallback

  private channel: RealtimeChannel | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private realtimeConnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private status: ConnectionStatus = 'connecting'

  constructor(
    conversationId: string,
    lastTimestamp: string,
    onMessage: MessageCallback,
    onStatusChange: StatusCallback
  ) {
    this.conversationId = conversationId
    this.lastTimestamp = lastTimestamp
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange
  }

  /** Start the transport. Tries realtime first, falls back to polling. */
  start() {
    this.setStatus('connecting')
    this.tryRealtime()
  }

  /** Clean up all timers and subscriptions. */
  destroy() {
    this.destroyed = true
    this.clearPollTimer()
    this.clearRealtimeTimer()
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private setStatus(s: ConnectionStatus) {
    if (this.status !== s) {
      this.status = s
      this.onStatusChange(s)
    }
  }

  private tryRealtime() {
    if (this.destroyed) return

    // Safety: remove any existing channel
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
    }

    this.channel = supabase
      .channel(`messages:${this.conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${this.conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          this.lastTimestamp = msg.created_at
          this.onMessage([msg])
        }
      )
      .subscribe((state) => {
        if (this.destroyed) return

        if (state === 'SUBSCRIBED') {
          this.clearRealtimeTimer()
          this.clearPollTimer()
          this.setStatus('realtime')
          console.log('[transport] Realtime connected')
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          console.warn(`[transport] Realtime ${state} → falling back to polling`)
          this.clearRealtimeTimer()
          this.startPolling()
        }
      })

    // If realtime hasn't connected within REALTIME_TIMEOUT_MS, start polling anyway
    this.realtimeConnectTimer = setTimeout(() => {
      if (this.status === 'connecting') {
        console.warn('[transport] Realtime connect timeout → starting polling')
        this.startPolling()
      }
    }, REALTIME_TIMEOUT_MS)
  }

  private startPolling() {
    if (this.destroyed) return
    if (this.pollTimer) return // already polling

    this.setStatus('polling')
    console.log('[transport] Polling started at', POLL_INTERVAL_MS, 'ms interval')

    // Poll immediately, then on interval
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
  }

  private async poll() {
    if (this.destroyed) return

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', this.conversationId)
        .gt('created_at', this.lastTimestamp)
        .order('created_at', { ascending: true })

      if (this.destroyed) return

      if (error) {
        console.error('[transport] Poll error:', error.message)
        this.setStatus('disconnected')
        return
      }

      if (this.status === 'disconnected') {
        this.setStatus('polling')
      }

      if (data && data.length > 0) {
        this.lastTimestamp = data[data.length - 1].created_at
        this.onMessage(data as Message[])
      }
    } catch (err) {
      if (this.destroyed) return
      console.error('[transport] Network error during poll:', err)
      this.setStatus('disconnected')
    }
  }

  private clearPollTimer() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private clearRealtimeTimer() {
    if (this.realtimeConnectTimer) {
      clearTimeout(this.realtimeConnectTimer)
      this.realtimeConnectTimer = null
    }
  }
}
