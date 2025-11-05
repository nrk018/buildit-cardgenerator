"use client"
import React, { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type Builder = { name: string; builder_number: number }

export default function VerifyPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid' | 'error'>('idle')
  const [builder, setBuilder] = useState<Builder | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const b = params.get('builder')
    if (!b) return
    setStatus('loading')
    fetch(`/api/verify/${encodeURIComponent(b)}`)
      .then(r => r.json())
      .then((res) => {
        if (res.valid) {
          setBuilder({ name: res.builder.name, builder_number: res.builder.builder_number })
          setStatus('valid')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <div className="card-surface" style={{ width: '100%', maxWidth: 720, padding: 28, display: 'flex', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72 }}>
          {status === 'loading' && <Loader2 size={56} className="spin"/>}
          {status === 'valid' && <CheckCircle2 size={56} color="#b8ffcc"/>}
          {status === 'invalid' && <XCircle size={56} color="#ffd5d5"/>}
          {status === 'error' && <XCircle size={56} color="#ffd5d5"/>}
        </div>
        <div className="vstack" style={{ flex: 1 }}>
          <h1 className="brand-title" style={{ margin: 0, fontSize: 32 }}>Builder Verification</h1>
          {status === 'idle' && (
            <p>Provide a builder number via the <code>?builder=</code> query parameter.</p>
          )}
          {status === 'loading' && (
            <p style={{ opacity: 0.9 }}>Checking membership…</p>
          )}
          {status === 'valid' && builder && (
            <div>
              <h2 style={{ marginTop: 8, marginBottom: 12 }}>Valid BUILD IT Member</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                <div style={{ opacity: 0.8 }}>Name</div><div><strong>{builder.name}</strong></div>
                <div style={{ opacity: 0.8 }}>Builder #</div><div><strong>{builder.builder_number}</strong></div>
              </div>
            </div>
          )}
          {status === 'invalid' && (
            <p>Not found. This builder number is not registered.</p>
          )}
          {status === 'error' && (
            <p>Something went wrong. Try again.</p>
          )}
        </div>
      </div>
      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}


