"use client"
import React, { useMemo, useState } from 'react'
import CardCanvas from '@/components/CardCanvas'
import { saveAs } from 'file-saver'
import Image from 'next/image'
import logoImage from '@/components/logobuildit.png'

export default function HomePage() {
  const [name, setName] = useState('')
  const [type, setType] = useState<'MEM' | 'EC' | 'CC' | 'JC'>('MEM')
  const [number, setNumber] = useState<number | ''>('')
  const [reg, setReg] = useState('')
  const [email, setEmail] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [builderId, setBuilderId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const builderNumber = useMemo(() => Number(number) || 0, [number])

  const onDownload = () => {
    if (!dataUrl) return
    const filename = `builder-${type}${builderNumber}.png`
    saveAs(dataUrl, filename)
    if (builderId) {
      fetch(`/api/builders/${builderId}/download`, { method: 'POST' })
    }
  }

  const onLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  return (
    <div className="vstack" style={{ gap: 24, width: '100%', padding: '24px', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{
        background: 'rgba(21, 208, 170, 0.15)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '12px 20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.2)',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        minWidth: 0
      }}>
        <div className="hstack" style={{ gap: 12, alignItems: 'center', minWidth: 0, flex: '0 1 auto' }}>
          <Image src={logoImage} alt="BUILDIT Logo" width={120} height={40} style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
          <h1 className="brand-title" style={{ margin: 0, fontSize: '22px', whiteSpace: 'nowrap' }}>Card Generator</h1>
        </div>
        <div className="hstack" style={{ gap: 8, flex: '0 0 auto', flexShrink: 0 }}>
          <a href="/admin" className="navbar-link" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.1)',
            textDecoration: 'none',
            transition: 'background 0.2s',
            border: '1px solid rgba(255,255,255,0.2)',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>Admin</a>
          <button onClick={onLogout} className="navbar-button" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            transition: 'background 0.2s',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>Logout</button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 24,
        width: '100%',
        alignItems: 'flex-start',
        flexWrap: 'wrap'
      }}>
        {/* Left Column: Card Preview */}
        <div style={{
          flex: '1 1 600px',
          minWidth: '300px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '1200px',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div className="card-preview-wrapper">
              <CardCanvas studentName={name || 'Student Name'} builderNumber={builderNumber || 1} type={type} onReady={setDataUrl}/>
            </div>
          </div>
        </div>

        {/* Right Column: Glassy Form Card */}
        <div style={{
          flex: '0 1 400px',
          minWidth: '300px',
          background: 'rgba(21, 208, 170, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>Create Builder Card</h2>
          
          <input 
            placeholder="Student name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          
          <select 
            value={type} 
            onChange={e => setType(e.target.value as 'MEM' | 'EC' | 'CC' | 'JC')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(21, 208, 170, 0.15)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: 'white',
              padding: '10px 12px',
              cursor: 'pointer'
            }}
          >
            <option value="MEM" style={{ background: '#0f7463', color: 'white' }}>MEM (Member)</option>
            <option value="EC" style={{ background: '#0f7463', color: 'white' }}>EC (Executive Committee)</option>
            <option value="CC" style={{ background: '#0f7463', color: 'white' }}>CC (Core Committee)</option>
            <option value="JC" style={{ background: '#0f7463', color: 'white' }}>JC (Junior Committee)</option>
          </select>
          
          <input 
            placeholder="Reg. number" 
            value={reg} 
            onChange={e => setReg(e.target.value)} 
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          
          <input 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            type="email"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          
          <input 
            placeholder="Builder number (blank = auto)" 
            value={number} 
            onChange={e => setNumber(e.target.value as any)} 
            type="number"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          
          {!builderId ? (
            <button 
              disabled={!name || creating} 
              onClick={async () => {
                setCreating(true)
                const res = await fetch('/api/builders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, registration_number: reg || undefined, email: email || undefined, builder_number: number === '' ? undefined : Number(number) }) })
                setCreating(false)
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}))
                  if (res.status === 409) {
                    alert(`Builder number ${type}${number || 'auto'} already exists! ${errorData.error || ''}`)
                  } else {
                    alert(`Failed to create builder: ${errorData.error || res.statusText}`)
                  }
                  return
                }
                const json = await res.json()
                setBuilderId(json.builder.id)
                setNumber(json.builder.builder_number)
              }}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {creating ? 'Creating...' : 'Create builder'}
            </button>
          ) : (
            <button 
              onClick={onDownload} 
              disabled={!dataUrl}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Download PNG
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


