import { useState } from 'react'

interface AuthFormProps {
  onSignIn: (email: string, password: string) => Promise<string | null>
  onSignUp: (email: string, password: string, username: string) => Promise<string | null>
}

export function AuthForm({ onSignIn, onSignUp }: AuthFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setError('')
    setInfo('')
    setLoading(true)
    let err: string | null = null
    if (mode === 'signin') {
      err = await onSignIn(email, password)
    } else {
      if (!username.trim()) {
        setError('Username is required')
        setLoading(false)
        return
      }
      err = await onSignUp(email, password, username.trim())
      if (!err) {
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
      }
    }
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-header">
          <span className="auth-logo">DM</span>
          <p className="auth-sub">direct messages, nothing else</p>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === 'signin' ? 'tab active' : 'tab'}
            onClick={() => { setMode('signin'); setError(''); setInfo('') }}
          >Sign in</button>
          <button
            className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => { setMode('signup'); setError(''); setInfo('') }}
          >Sign up</button>
        </div>

        {mode === 'signup' && (
          <input
            className="auth-input"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
          />
        )}
        <input
          className="auth-input"
          type="email"
          placeholder="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="auth-input"
          type="password"
          placeholder="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}

        <button className="auth-btn" onClick={handle} disabled={loading}>
          {loading ? '...' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </div>
    </div>
  )
}
