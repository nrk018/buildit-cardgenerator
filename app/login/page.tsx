"use client"
import React, { useState } from 'react'
import Image from 'next/image'
import logo from '@/components/logobuildit.png'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ password }) })
    setLoading(false)
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get('next') || '/admin'
      window.location.href = next
    } else {
      setError('Invalid password')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card-surface" style={{ padding: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 16 }}>
          <Image src={logo} alt="BUILD IT" width={420} height={420} style={{ width: '100%', height: 'auto' }}/>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="vstack" style={{ gap: 16, maxWidth: 420, width: '100%', padding: 24 }}>
          <h1 className="brand-title" style={{ margin: 0 }}>Admin login</h1>
          <form onSubmit={onSubmit} className="vstack" style={{ gap: 10 }}>
            <input type="password" placeholder="Admin password" value={password} onChange={e => setPassword(e.target.value)} />
            <button disabled={!password || loading} type="submit">{loading ? 'Signing in…' : 'Sign in'}</button>
            {error && <span style={{ color: '#ffd5d5' }}>{error}</span>}
          </form>
          
        </div>
      </div>
    </div>
  )
}


