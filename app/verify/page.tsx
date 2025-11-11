"use client"
import React, { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type Builder = { name: string; builder_number: number; type: string; department?: string | null }

export default function VerifyPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid' | 'error'>('idle')
  const [builder, setBuilder] = useState<Builder | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const b = params.get('builder')
    const type = params.get('type')
    if (!b) return
    setStatus('loading')
    
    // Build API URL with type if provided
    let apiUrl = `/api/verify/${encodeURIComponent(b)}`
    if (type) {
      apiUrl += `?type=${encodeURIComponent(type)}`
    }
    
    fetch(apiUrl)
      .then(r => r.json())
      .then((res) => {
        if (res.valid) {
          setBuilder({ 
            name: res.builder.name, 
            builder_number: res.builder.builder_number,
            type: res.builder.type || 'MEM',
            department: res.builder.department || null
          })
          setStatus('valid')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '20px', boxSizing: 'border-box' }}>
      <div className="card-surface verify-card" style={{ width: '100%', maxWidth: 720, padding: '28px', display: 'flex', gap: '18px', boxSizing: 'border-box' }}>
        <div className="verify-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '72px', flexShrink: 0 }}>
          {status === 'loading' && <Loader2 size={56} className="spin"/>}
          {status === 'valid' && <CheckCircle2 size={56} color="#b8ffcc"/>}
          {status === 'invalid' && <XCircle size={56} color="#ffd5d5"/>}
          {status === 'error' && <XCircle size={56} color="#ffd5d5"/>}
        </div>
        <div className="vstack verify-content" style={{ flex: 1, minWidth: 0 }}>
          <h1 className="brand-title verify-title" style={{ margin: 0, fontSize: '32px', wordWrap: 'break-word' }}>Builder Verification</h1>
          {status === 'idle' && (
            <p className="verify-text" style={{ fontSize: '16px', lineHeight: '1.6', wordWrap: 'break-word' }}>
              Provide a builder number via the <code style={{ fontSize: '14px', padding: '2px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>?builder=</code> query parameter. Optionally include <code style={{ fontSize: '14px', padding: '2px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>&type=</code> for type-specific verification (e.g., <code style={{ fontSize: '14px', padding: '2px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>?builder=1&type=EC</code>).
            </p>
          )}
          {status === 'loading' && (
            <p className="verify-text" style={{ opacity: 0.9, fontSize: '16px' }}>Checking membership…</p>
          )}
          {status === 'valid' && builder && (
            <div style={{ width: '100%' }}>
              <h2 className="verify-subtitle" style={{ marginTop: '8px', marginBottom: '12px', fontSize: '24px', fontWeight: '600' }}>Valid BUILDIT Member</h2>
              <div className="verify-info-grid" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', width: '100%' }}>
                <div style={{ opacity: 0.8, fontSize: '15px' }}>Name</div>
                <div style={{ fontWeight: '600', wordBreak: 'break-word' }}>{builder.name}</div>
                <div style={{ opacity: 0.8, fontSize: '15px' }}>Builder #</div>
                <div style={{ fontWeight: '600', wordBreak: 'break-word' }}>{builder.type}{builder.builder_number}</div>
                {builder.department && (
                  <>
                    <div style={{ opacity: 0.8, fontSize: '15px' }}>Department</div>
                    <div style={{ fontWeight: '600', wordBreak: 'break-word' }}>{builder.department}</div>
                  </>
                )}
              </div>
            </div>
          )}
          {status === 'invalid' && (
            <p className="verify-text" style={{ fontSize: '16px' }}>Not found. This builder number is not registered.</p>
          )}
          {status === 'error' && (
            <p className="verify-text" style={{ fontSize: '16px' }}>Something went wrong. Try again.</p>
          )}
        </div>
      </div>
      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        /* Responsive styles for verification page */
        @media (max-width: 768px) {
          .verify-card {
            flex-direction: column !important;
            padding: 20px !important;
            gap: 16px !important;
          }
          
          .verify-icon {
            width: 56px !important;
            margin: 0 auto;
          }
          
          .verify-icon svg {
            width: 48px !important;
            height: 48px !important;
          }
          
          .verify-title {
            font-size: 24px !important;
            text-align: center;
          }
          
          .verify-subtitle {
            font-size: 20px !important;
            text-align: center;
          }
          
          .verify-text {
            font-size: 14px !important;
            text-align: center;
          }
          
          .verify-info-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          
          .verify-info-grid > div:nth-child(odd) {
            font-weight: 600;
            opacity: 0.9;
            margin-top: 8px;
          }
          
          .verify-info-grid > div:nth-child(even) {
            margin-bottom: 4px;
          }
        }
        
        @media (max-width: 480px) {
          .container {
            padding: 12px !important;
          }
          
          .verify-card {
            padding: 16px !important;
            gap: 12px !important;
          }
          
          .verify-icon {
            width: 48px !important;
          }
          
          .verify-icon svg {
            width: 40px !important;
            height: 40px !important;
          }
          
          .verify-title {
            font-size: 20px !important;
          }
          
          .verify-subtitle {
            font-size: 18px !important;
          }
          
          .verify-text {
            font-size: 13px !important;
          }
          
          .verify-text code {
            font-size: 11px !important;
            padding: 1px 3px !important;
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          .verify-card {
            padding: 24px !important;
            gap: 16px !important;
          }
          
          .verify-icon {
            width: 64px !important;
          }
          
          .verify-icon svg {
            width: 52px !important;
            height: 52px !important;
          }
          
          .verify-title {
            font-size: 28px !important;
          }
          
          .verify-subtitle {
            font-size: 22px !important;
          }
        }
      `}</style>
    </div>
  )
}


