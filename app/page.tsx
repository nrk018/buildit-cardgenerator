"use client"
import React, { useMemo, useState, useEffect } from 'react'
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
  const [department, setDepartment] = useState<string>('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [builderId, setBuilderId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [loadingNextNumber, setLoadingNextNumber] = useState(false)

  const builderNumber = useMemo(() => Number(number) || 0, [number])

  // Fetch next available builder number for the selected type
  const fetchNextBuilderNumber = React.useCallback(async (memberType: 'MEM' | 'EC' | 'CC' | 'JC') => {
    setLoadingNextNumber(true)
    try {
      const res = await fetch('/api/builders/next-number?type=' + memberType)
      if (res.ok) {
        const data = await res.json()
        setNumber(data.nextNumber || 1)
      } else {
        // If API fails, just set to 1
        setNumber(1)
      }
    } catch (error) {
      console.error('Failed to fetch next builder number:', error)
      setNumber(1)
    } finally {
      setLoadingNextNumber(false)
    }
  }, [])

  // Fetch next number on component mount and when type changes
  useEffect(() => {
    fetchNextBuilderNumber(type)
  }, [type, fetchNextBuilderNumber])

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
            onChange={e => {
              const newType = e.target.value as 'MEM' | 'EC' | 'CC' | 'JC'
              setType(newType)
              if (newType === 'MEM') {
                setDepartment('')
              }
            }}
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
          
          {type !== 'MEM' && (
            <select 
              value={department} 
              onChange={e => setDepartment(e.target.value)}
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
              <option value="" style={{ background: '#0f7463', color: 'white' }}>Select Department</option>
              <option value="Finance" style={{ background: '#0f7463', color: 'white' }}>Finance</option>
              <option value="Production" style={{ background: '#0f7463', color: 'white' }}>Production</option>
              <option value="Media & Design" style={{ background: '#0f7463', color: 'white' }}>Media & Design</option>
              <option value="Human Resources" style={{ background: '#0f7463', color: 'white' }}>Human Resources</option>
              <option value="Technical Projects" style={{ background: '#0f7463', color: 'white' }}>Technical Projects</option>
              <option value="Technical Communication" style={{ background: '#0f7463', color: 'white' }}>Technical Communication</option>
              <option value="Project Development" style={{ background: '#0f7463', color: 'white' }}>Project Development</option>
              <option value="Logistics" style={{ background: '#0f7463', color: 'white' }}>Logistics</option>
            </select>
          )}
          
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                placeholder="Builder number" 
                value={number} 
                onChange={e => setNumber(e.target.value as any)} 
                type="number"
                disabled={loadingNextNumber}
                style={{ 
                  flex: 1,
                  boxSizing: 'border-box',
                  opacity: loadingNextNumber ? 0.6 : 1,
                  cursor: loadingNextNumber ? 'wait' : 'text'
                }}
              />
              <button
                type="button"
                onClick={() => fetchNextBuilderNumber(type)}
                disabled={loadingNextNumber}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: loadingNextNumber ? 'wait' : 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  opacity: loadingNextNumber ? 0.6 : 1
                }}
                title="Refresh next number"
              >
                🔄
              </button>
            </div>
            {loadingNextNumber && (
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Loading next number...</span>
            )}
            {!loadingNextNumber && number && (
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                Next available: {type}{number}
              </span>
            )}
          </div>
          
          {!builderId ? (
            <button 
              disabled={!name || creating} 
              onClick={async () => {
                // Validate department for EC, CC, JC types
                if (type !== 'MEM' && !department) {
                  alert('Please select a department for ' + (type === 'EC' ? 'Executive Committee' : type === 'CC' ? 'Core Committee' : 'Junior Committee') + ' members')
                  return
                }
                
                setCreating(true)
                const res = await fetch('/api/builders', { 
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' }, 
                  body: JSON.stringify({ 
                    name, 
                    type, 
                    registration_number: reg || undefined, 
                    email: email || undefined, 
                    builder_number: number === '' ? undefined : Number(number),
                    department: type !== 'MEM' ? (department || null) : null
                  }) 
                })
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
                // Refresh next number for future use (in case user wants to create another)
                fetchNextBuilderNumber(type)
              }}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {creating ? 'Creating...' : 'Create builder'}
            </button>
          ) : (
            <>
              <button 
                onClick={onDownload} 
                disabled={!dataUrl}
                style={{ width: '100%', marginTop: '8px' }}
              >
                Download PNG
              </button>
              <button 
                onClick={() => {
                  setBuilderId(null)
                  setName('')
                  setReg('')
                  setEmail('')
                  setDepartment('')
                  setDataUrl(null)
                  // Refresh next number for the current type
                  fetchNextBuilderNumber(type)
                }}
                style={{ 
                  width: '100%', 
                  marginTop: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                Create Another
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


