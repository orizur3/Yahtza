'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('סיסמה שגויה — נסה שוב')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif', direction: 'rtl',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 16, padding: 40,
        width: 360, border: '1px solid #334155',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>מערכת דיווחי אירועים</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>גישה מורשית בלבד</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>סיסמה</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="הכנס סיסמה..."
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '1px solid #475569', background: '#0f172a',
              color: '#fff', fontSize: 14, fontFamily: 'Arial',
              outline: 'none', boxSizing: 'border-box', direction: 'rtl',
            }}
          />
        </div>

        {error && (
          <div style={{ background: '#450a0a', color: '#fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || !password}
          style={{
            width: '100%', padding: '11px', borderRadius: 8, border: 'none',
            background: loading || !password ? '#475569' : '#e24b4a',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading || !password ? 'default' : 'pointer',
            fontFamily: 'Arial',
          }}
        >
          {loading ? 'מתחבר...' : 'כניסה'}
        </button>
      </div>
    </div>
  )
}
