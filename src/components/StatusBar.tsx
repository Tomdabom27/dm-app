import { ConnectionStatus } from '../types'

interface StatusBarProps {
  status: ConnectionStatus
}

const labels: Record<ConnectionStatus, string> = {
  realtime: '● live',
  polling: '◌ polling',
  connecting: '○ connecting',
  disconnected: '✕ offline',
}

const colors: Record<ConnectionStatus, string> = {
  realtime: 'var(--green)',
  polling: 'var(--yellow)',
  connecting: 'var(--muted)',
  disconnected: 'var(--red)',
}

export function StatusBar({ status }: StatusBarProps) {
  return (
    <span
      className="status-bar"
      style={{ color: colors[status] }}
      title={
        status === 'realtime' ? 'Connected via WebSocket' :
        status === 'polling' ? 'WebSocket unavailable — using HTTP polling (4s)' :
        status === 'connecting' ? 'Establishing connection…' :
        'No connection'
      }
    >
      {labels[status]}
    </span>
  )
}
