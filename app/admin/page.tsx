"use client"
import React, { useEffect, useMemo, useState } from 'react'
import { saveAs } from 'file-saver'
import CardCanvas from '@/components/CardCanvas'
import { Loader2, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import logoImage from '@/components/logobuildit.png'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type Builder = { id?: string; name: string; builder_number: number; type: string; registration_number?: string | null; email?: string | null; department?: string | null; downloaded_at?: string | null; email_sent_at?: string | null }

export default function AdminPage() {
  const [builders, setBuilders] = useState<Builder[]>([])
  const [filterType, setFilterType] = useState<'ALL' | 'MEM' | 'EC' | 'CC' | 'JC'>('ALL')
  const [preview, setPreview] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>('')
  const [previewNum, setPreviewNum] = useState<number>(0)
  const [previewType, setPreviewType] = useState<string>('MEM')
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'MEM' | 'EC' | 'CC' | 'JC'>('MEM')
  const [editReg, setEditReg] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const fetchBuilders = async () => {
    const res = await fetch('/api/builders')
    const json = await res.json()
    setBuilders(json.builders || [])
  }

  useEffect(() => { fetchBuilders() }, [])

  const onLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  const filteredBuilders = filterType === 'ALL' 
    ? builders 
    : builders.filter(b => b.type === filterType)

  const onDownloadData = async () => {
    const typeLabel = filterType === 'ALL' ? 'All Types' : filterType
    const typeFullName = filterType === 'ALL' ? 'All Types' : 
                        filterType === 'MEM' ? 'Member' :
                        filterType === 'EC' ? 'Executive Committee' :
                        filterType === 'CC' ? 'Core Committee' :
                        filterType === 'JC' ? 'Junior Committee' : filterType

    // Load logo as base64
    const logoDataUrl = await loadLogoAsBase64()

    const doc = new jsPDF('landscape', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    // Set background color (teal)
    doc.setFillColor(15, 116, 99) // #0f7463
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    
    // Add logo at the top center
    let logoHeight = 0
    let titleY = 25
    try {
      if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
        const logoWidth = 50 // mm
        // Get actual image dimensions to maintain aspect ratio
        const img = document.createElement('img')
        await new Promise<void>((resolve) => {
          img.onload = () => {
            const aspectRatio = img.height / img.width
            logoHeight = logoWidth * aspectRatio
            const logoX = (pageWidth - logoWidth) / 2
            doc.addImage(logoDataUrl, 'PNG', logoX, 10, logoWidth, logoHeight)
            titleY = 15 + logoHeight + 8
            resolve()
          }
          img.onerror = () => resolve()
          img.src = logoDataUrl
        })
      }
    } catch (e) {
      console.error('Failed to add logo:', e)
    }
    
    // Add title below logo (with spacing)
    doc.setTextColor(255, 255, 255) // White text
    doc.setFontSize(26)
    doc.setFont('helvetica', 'bold')
    const titleText = `${typeFullName} Builder List`
    const titleWidth = doc.getTextWidth(titleText)
    doc.text(titleText, (pageWidth - titleWidth) / 2, titleY)
    
    // Prepare table data
    const tableData = filteredBuilders.map(b => [
      b.name || '—',
      `${b.type || 'MEM'}${b.builder_number}`,
      b.registration_number || '—',
      b.email || '—',
      b.department || '—',
      b.email_sent_at ? new Date(b.email_sent_at).toLocaleDateString() : '—'
    ])

    // Dark green glass look - consistent color
    // Using a medium dark green that gives glass effect appearance
    const glassGreen: [number, number, number] = [24, 165, 143] // Medium teal-green for glass effect

    // Calculate table start position based on title
    const tableStartY = titleY + 10
    
    // Add table with consistent dark green glass styling
    autoTable(doc, {
      head: [['Name', 'Builder Number', 'Registration Number', 'Email', 'Department', 'Email Sent Date']],
      body: tableData,
      startY: tableStartY,
      theme: 'plain',
      styles: {
        fillColor: glassGreen as any, // Consistent glass green for all cells
        textColor: [255, 255, 255] as any, // White text
        fontSize: 9,
        cellPadding: 4,
        lineColor: [255, 255, 255] as any, // White borders
        lineWidth: 0.3,
        fontStyle: 'normal'
      },
      headStyles: {
        fillColor: [21, 208, 170] as any, // Slightly lighter green for header
        textColor: [255, 255, 255] as any,
        fontStyle: 'bold',
        fontSize: 10,
        lineColor: [255, 255, 255] as any,
        lineWidth: 0.3
      },
      bodyStyles: {
        fillColor: glassGreen as any, // Consistent glass green for all body cells
        textColor: [255, 255, 255] as any,
        lineColor: [255, 255, 255] as any,
        lineWidth: 0.3
      },
      alternateRowStyles: {
        fillColor: [22, 178, 156] as any // Slightly different shade for alternate rows (still green)
      },
      margin: { top: tableStartY, left: 10, right: 10, bottom: 10 }
    })

    // Save PDF
    doc.save(`${typeLabel.toLowerCase()}-builder-list.pdf`)
  }

  const onPreview = async (b: Builder) => {
    setPreviewName(b.name)
    setPreviewNum(b.builder_number)
    setPreviewType(b.type || 'MEM')
  }

  const onEdit = (b: Builder) => {
    setEditingId(b.id || null)
    setEditName(b.name)
    setEditType((b.type || 'MEM') as 'MEM' | 'EC' | 'CC' | 'JC')
    setEditReg(b.registration_number || '')
    setEditEmail(b.email || '')
    setEditDepartment(b.department || '')
  }

  const onSaveEdit = async () => {
    if (!editingId) return
    const res = await fetch(`/api/builders/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: editName, 
        type: editType, 
        registration_number: editReg || null, 
        email: editEmail || null,
        department: editType !== 'MEM' ? (editDepartment || null) : null
      })
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      if (res.status === 409) {
        alert(`Builder number ${editType} already exists! ${errorData.error || ''}`)
      } else {
        alert(`Failed to update: ${errorData.error || res.statusText}`)
      }
      return
    }
    setEditingId(null)
    fetchBuilders()
  }

  const onCancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditType('MEM')
    setEditReg('')
    setEditEmail('')
    setEditDepartment('')
  }

  const onDelete = async (id: string) => {
    const res = await fetch(`/api/builders/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Failed to delete'); return }
    setDeleteConfirmId(null)
    fetchBuilders()
  }

  const latestPngName = useMemo(() => `builder-${previewType}${previewNum}.png`, [previewNum, previewType])

  return (
    <div className="vstack" style={{ gap: 18, width: '100%', padding: '24px', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
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
          <h1 className="brand-title" style={{ margin: 0, fontSize: '22px', whiteSpace: 'nowrap' }}>Admin Panel</h1>
        </div>
        <div className="hstack" style={{ gap: 8, flex: '0 0 auto', flexShrink: 0 }}>
          <a href="/" className="navbar-link" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.1)',
            textDecoration: 'none',
            transition: 'background 0.2s',
            border: '1px solid rgba(255,255,255,0.2)',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>Generator</a>
          <button onClick={onLogout} className="navbar-button" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            transition: 'background 0.2s',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>Logout</button>
        </div>
      </div>

      <div className="hstack" style={{ gap: 12, flexWrap: 'wrap', width: '100%', marginBottom: '8px' }}>
        <select 
          value={filterType} 
          onChange={e => setFilterType(e.target.value as 'ALL' | 'MEM' | 'EC' | 'CC' | 'JC')}
          style={{
            flex: '0 1 200px',
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
          <option value="ALL" style={{ background: '#0f7463', color: 'white' }}>All Types</option>
          <option value="MEM" style={{ background: '#0f7463', color: 'white' }}>MEM (Member)</option>
          <option value="EC" style={{ background: '#0f7463', color: 'white' }}>EC (Executive Committee)</option>
          <option value="CC" style={{ background: '#0f7463', color: 'white' }}>CC (Core Committee)</option>
          <option value="JC" style={{ background: '#0f7463', color: 'white' }}>JC (Junior Committee)</option>
        </select>
        <button 
          onClick={onDownloadData} 
          disabled={!filteredBuilders.length}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(21, 208, 170, 0.3)',
            color: 'white',
            cursor: filteredBuilders.length ? 'pointer' : 'not-allowed',
            opacity: filteredBuilders.length ? 1 : 0.6,
            fontWeight: '600'
          }}
        >
          Download Data
        </button>
      </div>

      <div style={{
        background: 'rgba(21, 208, 170, 0.15)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: 12,
        width: '100%',
        overflowX: 'auto',
        boxSizing: 'border-box',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={{ width: '7%', padding: '6px 8px' }}>Builder #</th>
              <th style={{ width: '6%', padding: '6px 8px' }}>Type</th>
              <th style={{ width: '12%', padding: '6px 8px' }}>Name</th>
              <th style={{ width: '10%', padding: '6px 8px' }}>Reg #</th>
              <th style={{ width: '15%', padding: '6px 8px' }}>Email</th>
              <th style={{ width: '12%', padding: '6px 8px' }}>Department</th>
              <th style={{ width: '9%', padding: '6px 8px' }}>Downloaded?</th>
              <th style={{ width: '8%', padding: '6px 8px' }}>Email Sent</th>
              <th style={{ width: '21%', padding: '6px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBuilders.map(b => (
              <tr key={`${b.type}-${b.builder_number}-${b.name}`}>
                <td style={{ padding: '6px 8px', fontWeight: '600' }}>{b.type || 'MEM'}{b.builder_number}</td>
                <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingId === b.id ? (
                    <select 
                      value={editType} 
                      onChange={e => {
                        const newType = e.target.value as 'MEM' | 'EC' | 'CC' | 'JC'
                        setEditType(newType)
                        if (newType === 'MEM') {
                          setEditDepartment('')
                        }
                      }}
                      style={{
                        width: '100%',
                        fontSize: '13px',
                        padding: '4px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(21, 208, 170, 0.15)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="MEM" style={{ background: '#0f7463', color: 'white' }}>MEM</option>
                      <option value="EC" style={{ background: '#0f7463', color: 'white' }}>EC</option>
                      <option value="CC" style={{ background: '#0f7463', color: 'white' }}>CC</option>
                      <option value="JC" style={{ background: '#0f7463', color: 'white' }}>JC</option>
                    </select>
                  ) : (
                    <span>{b.type || 'MEM'}</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingId === b.id ? (
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', fontSize: '13px', padding: '4px' }} />
                  ) : (
                    <span title={b.name} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingId === b.id ? (
                    <input value={editReg} onChange={e => setEditReg(e.target.value)} style={{ width: '100%', fontSize: '13px', padding: '4px' }} />
                  ) : (
                    <span title={b.registration_number || ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.registration_number || '—'}</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingId === b.id ? (
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" style={{ width: '100%', fontSize: '13px', padding: '4px' }} />
                  ) : (
                    <span title={b.email || ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.email || '—'}</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingId === b.id ? (
                    editType !== 'MEM' ? (
                      <select 
                        value={editDepartment} 
                        onChange={e => setEditDepartment(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '13px',
                          padding: '4px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(21, 208, 170, 0.15)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="" style={{ background: '#0f7463', color: 'white' }}>Select</option>
                        <option value="Finance" style={{ background: '#0f7463', color: 'white' }}>Finance</option>
                        <option value="Production" style={{ background: '#0f7463', color: 'white' }}>Production</option>
                        <option value="Media & Design" style={{ background: '#0f7463', color: 'white' }}>Media & Design</option>
                        <option value="Human Resources" style={{ background: '#0f7463', color: 'white' }}>Human Resources</option>
                        <option value="Technical Projects" style={{ background: '#0f7463', color: 'white' }}>Technical Projects</option>
                        <option value="Technical Communication" style={{ background: '#0f7463', color: 'white' }}>Technical Communication</option>
                        <option value="Project Development" style={{ background: '#0f7463', color: 'white' }}>Project Development</option>
                        <option value="Logistics" style={{ background: '#0f7463', color: 'white' }}>Logistics</option>
                      </select>
                    ) : (
                      <span>—</span>
                    )
                  ) : (
                    <span title={b.department || ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.department || '—'}</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.downloaded_at ? new Date(b.downloaded_at).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '6px 8px', fontSize: '12px' }}>
                  {b.email_sent_at ? (
                    <span style={{ color: '#18c5a6' }}>
                      {new Date(b.email_sent_at).toLocaleDateString()}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '6px 8px', overflow: 'visible' }}>
                  <div className="hstack" style={{ gap: 4, position: 'relative', flexWrap: 'wrap' }}>
                    {editingId === b.id ? (
                      <>
                        <button onClick={onSaveEdit} style={{ fontSize: '11px', padding: '3px 6px' }}>Save</button>
                        <button onClick={onCancelEdit} style={{ fontSize: '11px', padding: '3px 6px' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => onPreview(b)} style={{ fontSize: '11px', padding: '3px 6px' }}>Preview</button>
                        <button onClick={() => onEdit(b)} style={{ fontSize: '11px', padding: '3px 6px' }}>Edit</button>
                        <button onClick={() => setDeleteConfirmId(b.id || null)} style={{ fontSize: '11px', padding: '3px 6px', background: 'rgba(255,0,0,0.2)' }}>Delete</button>
                        <button 
                      disabled={!b.email || sendingEmail === b.id} 
                      onClick={async () => {
                        if (!b.id) return
                        setSendingEmail(b.id)
                        setEmailSuccess(null)
                        try {
                          const dataUrl = await renderCardAsDataUrl(b.name, b.builder_number, b.type || 'MEM')
                          const base64 = dataUrl.split(',')[1]
                          const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#000000;">
<h1 style="font-size:28px;font-weight:700;margin:0 0 20px 0;">Welcome to BUILDIT 🎉</h1>

<p style="font-size:18px;margin:0 0 10px 0;">Hi ${b.name},</p>

<p style="font-size:18px;margin:0 0 30px 0;">Congratulations! You're now an official BUILDIT member. Your exclusive builder card is ready!</p>

<p style="font-size:16px;margin:0 0 40px 0;">Your builder card image is attached to this email. Please download and save it to your device.</p>

<!-- Clipped Content Below -->

<h2 style="font-size:24px;font-weight:700;margin:40px 0 20px 0;color:#000000;">Your Builder Card Perks</h2>

<div style="margin:0 0 30px 0;">
<h3 style="font-size:20px;font-weight:600;margin:0 0 8px 0;color:#000000;">Free Access to Minor Events</h3>
<p style="font-size:16px;margin:0 0 0 0;color:#333333;">Attend workshops, networking sessions, and club meetups at no cost</p>
</div>

<div style="margin:0 0 30px 0;">
<h3 style="font-size:20px;font-weight:600;margin:0 0 8px 0;color:#000000;">Discounted Entry for Major Events</h3>
<p style="font-size:16px;margin:0 0 0 0;color:#333333;">Get exclusive discounts on conferences, hackathons, and flagship events</p>
</div>

<div style="margin:0 0 30px 0;">
<h3 style="font-size:20px;font-weight:600;margin:0 0 8px 0;color:#000000;">Priority Access & Early Bird Benefits</h3>
<p style="font-size:16px;margin:0 0 0 0;color:#333333;">Be the first to register for limited-seat events and competitions</p>
</div>

<div style="margin:0 0 40px 0;">
<h3 style="font-size:20px;font-weight:600;margin:0 0 8px 0;color:#000000;">Exclusive Networking Opportunities</h3>
<p style="font-size:16px;margin:0 0 0 0;color:#333333;">Connect with industry experts, mentors, and fellow builders</p>
</div>

<h2 style="font-size:24px;font-weight:700;margin:40px 0 20px 0;color:#000000;">Important Security Notice</h2>
<p style="font-size:16px;margin:0 0 40px 0;color:#333333;">This card is unique to you (Builder #${b.builder_number}). Please do not share your card with anyone else. Keep it secure and present it at events to avail your benefits.</p>

<h2 style="font-size:24px;font-weight:700;margin:40px 0 20px 0;color:#000000;">Verify Your Card</h2>
<p style="font-size:16px;margin:0 0 10px 0;color:#333333;">Scan the QR code on your card or visit:</p>
<p style="font-size:16px;margin:0 0 40px 0;"><a href="${window.location.origin}/verify?builder=${encodeURIComponent(b.builder_number)}" style="color:#0000EE;text-decoration:underline;">${window.location.origin}/verify?builder=${encodeURIComponent(b.builder_number)}</a></p>

<h2 style="font-size:24px;font-weight:700;margin:40px 0 20px 0;color:#000000;">How to Use Your Card</h2>
<ul style="font-size:16px;margin:0 0 40px 0;padding-left:25px;color:#333333;">
<li style="margin:0 0 10px 0;">Save the card image to your phone for easy access</li>
<li style="margin:0 0 10px 0;">Present your card at event registration desks</li>
<li style="margin:0 0 10px 0;">Show the QR code when checking in at events</li>
<li style="margin:0 0 0 0;">Keep a digital copy backed up in your gallery</li>
</ul>

<h2 style="font-size:24px;font-weight:700;margin:40px 0 20px 0;color:#000000;">Ready to Build Something That Matters?</h2>
<p style="font-size:16px;margin:0 0 20px 0;color:#333333;">We're excited to have you on board! Stay tuned for upcoming events and opportunities. Follow us on social media to stay updated.</p>

<p style="font-size:16px;margin:30px 0 0 0;color:#666666;">The BUILDIT Team<br>builditmuj.club</p>
</div>`
                          const res = await fetch('/api/email/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                              to: b.email,
                              subject: `Your BUILDIT Builder Card (#${b.builder_number})`,
                              html,
                              attachmentName: `builder-${b.builder_number}.png`,
                              attachmentBase64: base64,
                              builderId: b.id
                            })
                          })
                          if (res.ok) {
                            setEmailSuccess(b.id)
                            setTimeout(() => setEmailSuccess(null), 3000)
                            fetchBuilders()
                          } else {
                            const errorData = await res.json().catch(() => ({}))
                            alert(`Failed to send email: ${errorData.error || res.statusText || 'Unknown error'}`)
                          }
                        } catch (err: any) {
                          const errorMsg = err?.message || 'Failed to send email'
                          if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
                            alert(`Email sending timed out: ${errorMsg}. Please try again.`)
                          } else {
                            alert(`Failed to send email: ${errorMsg}`)
                          }
                          console.error('Email send error:', err)
                        } finally {
                          setSendingEmail(null)
                        }
                      }}
                      style={{ position: 'relative', fontSize: '11px', padding: '3px 6px', minWidth: 'auto' }}
                    >
                      {sendingEmail === b.id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Loader2 size={12} className="spin" />
                          Sending...
                        </span>
                      ) : emailSuccess === b.id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#18c5a6' }}>
                          <CheckCircle2 size={12} />
                          Sent!
                        </span>
                      ) : (
                          'Email'
                        )}
                      </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewName && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => { setPreviewName(''); setPreview(null) }} />
          <div style={{
            background: 'rgba(21, 208, 170, 0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: 24,
            width: '100%',
            maxWidth: 1300,
            position: 'relative',
            zIndex: 1001,
            maxHeight: '95vh',
            overflowY: 'auto'
          }}>
            <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>Preview: {previewName} — {previewType}{previewNum}</h3>
              <button onClick={() => { setPreviewName(''); setPreview(null) }} style={{ padding: '6px 12px', fontSize: 14, background: 'rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer' }}>✕ Close</button>
            </div>
            <div style={{ overflow: 'auto', borderRadius: '8px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '10px' }}>
              <CardCanvas key={`${previewType}-${previewNum}-${previewName}`} studentName={previewName} builderNumber={previewNum} type={previewType} onReady={setPreview}/>
            </div>
            <div className="vstack" style={{ gap: 12 }}>
              <button onClick={() => preview && saveAs(preview, latestPngName)} disabled={!preview} style={{ width: '100%', padding: '12px' }}>Download PNG</button>
              <a href={`/verify?builder=${previewNum}`} target="_blank" rel="noreferrer" style={{ textAlign: 'center', display: 'block', padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none' }}>Open Verification Page</a>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (() => {
        const builder = builders.find(b => b.id === deleteConfirmId)
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setDeleteConfirmId(null)} />
            <div style={{
              background: 'rgba(21, 208, 170, 0.15)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: 32,
              width: '100%',
              maxWidth: 400,
              position: 'relative',
              zIndex: 1003
            }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Delete Builder</h2>
              <p style={{ margin: '0 0 24px 0', fontSize: 15, lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>{builder?.name}</strong> (Builder #{builder?.builder_number})? This action cannot be undone.
              </p>
              <div className="hstack" style={{ gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '8px 16px' }}>Cancel</button>
                <button onClick={() => deleteConfirmId && onDelete(deleteConfirmId)} style={{ padding: '8px 16px', background: 'rgba(255,0,0,0.3)', borderColor: 'rgba(255,0,0,0.5)' }}>Yes, Delete</button>
              </div>
            </div>
          </div>
        )
      })()}
      <style jsx global>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .navbar-link:hover {
          background: rgba(255,255,255,0.2) !important;
        }
        .navbar-button:hover {
          background: rgba(255,255,255,0.15) !important;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .email-success {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

function loadLogoAsBase64(): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      // Fallback to empty transparent 1x1 if logo fails to load
      resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
    }
    img.src = typeof logoImage === 'string' ? logoImage : (logoImage as any).src || logoImage
  })
}

function renderCardAsDataUrl(name: string, number: number, type: string = 'MEM'): Promise<string> {
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ')
    let line = ''
    let cy = y
    words.forEach((w, i) => {
      const test = line ? line + ' ' + w : w
      const metrics = ctx.measureText(test)
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, cy)
        line = w
        cy += lineHeight
      } else {
        line = test
      }
    })
    if (line) ctx.fillText(line, x, cy)
  }

  function drawField(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number) {
    const LABEL_COL = 340
    const FIELD_H = 64
    const RADIUS = 18
    const fieldX = x + LABEL_COL
    const fieldY = y
    const centerY = fieldY + FIELD_H / 2
    const fieldW = Math.max(300, width - LABEL_COL)

    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.9)'
    ctx.font = '800 32px Inter, ui-sans-serif, system-ui'
    const labelText = `${label} :`
    ctx.fillText(labelText, x, centerY)

    roundRect(ctx, fieldX, fieldY, fieldW, FIELD_H, RADIUS)
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.fill()

    ctx.fillStyle = '#11423c'
    ctx.font = '700 30px Inter, ui-sans-serif, system-ui'
    ctx.fillText(value, fieldX + 18, centerY)
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, timeoutReject) => {
        setTimeout(() => timeoutReject(new Error('Card generation timed out after 30 seconds')), 30000)
      })

      const cardPromise = (async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1200
        canvas.height = 675
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        grad.addColorStop(0, '#18c5a6')
        grad.addColorStop(0.4, '#11a58d')
        grad.addColorStop(1, '#0b6f62')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Soft vignettes
        const vignette = ctx.createRadialGradient(canvas.width * 0.9, canvas.height * 0.25, 50, canvas.width, 0, canvas.width)
        vignette.addColorStop(0, 'rgba(255,255,255,0.15)')
        vignette.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = vignette
        ctx.beginPath()
        ctx.arc(canvas.width * 0.9, canvas.height * 0.25, canvas.height * 0.55, 0, Math.PI * 2)
        ctx.fill()

        // Left BUILD IT rail
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(40, 0, 14, canvas.height)

        // Title
        ctx.fillStyle = 'white'
        ctx.font = '900 86px Inter, ui-sans-serif, system-ui'
        ctx.textBaseline = 'top'
        wrapText(ctx, 'WELCOME TO THE CLUB BUILDER!', 120, 70, canvas.width * 0.6, 90)

        ctx.font = '600 28px Inter, ui-sans-serif, system-ui'
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillText("Let's build something that matters", 120, 70 + 90 * 3 + 12)

        // Labels and fields
        const labelTop = canvas.height - 230
        drawField(ctx, 'STUDENT NAME', name, 120, labelTop, canvas.width * 0.58)
        drawField(ctx, 'BUILDER NUMBER', `${type}${number}`, 120, labelTop + 96, canvas.width * 0.58)

        // QR code with timeout
        const qrSize = 230
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const verifyUrl = origin
          ? new URL(`/verify?builder=${encodeURIComponent(number)}`, origin).toString()
          : `/verify?builder=${encodeURIComponent(number)}`
        
        const qrDataUrl = await Promise.race([
          QRCode.toDataURL(verifyUrl, { margin: 1, width: qrSize }),
          new Promise<never>((_, qrReject) => setTimeout(() => qrReject(new Error('QR code generation timed out')), 10000))
        ])
        
        const img = document.createElement('img')
        await Promise.race([
          new Promise<void>((resolveImg) => {
            img.onload = () => resolveImg()
            img.onerror = () => reject(new Error('Failed to load QR code image'))
            img.src = qrDataUrl
          }),
          new Promise<never>((_, imgReject) => setTimeout(() => imgReject(new Error('Image load timed out')), 5000))
        ])
        
        ctx.drawImage(img, canvas.width - qrSize - 80, canvas.height - qrSize - 80, qrSize, qrSize)

        // Footer URL
        ctx.font = '600 22px Inter, ui-sans-serif, system-ui'
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.fillText('builditmuj.club', canvas.width - 300, canvas.height - 30)

        return canvas.toDataURL('image/png')
      })()

      const result = await Promise.race([cardPromise, timeoutPromise])
      resolve(result)
    } catch (error: any) {
      console.error('Error rendering card:', error)
      reject(error)
    }
  })
}


