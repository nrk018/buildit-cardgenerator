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
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL')
  const [preview, setPreview] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>('')
  const [previewNum, setPreviewNum] = useState<number>(0)
  const [previewType, setPreviewType] = useState<string>('MEM')
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [bulkSendingType, setBulkSendingType] = useState<'EC' | 'CC' | 'JC' | null>(null)
  const [bulkSendProgress, setBulkSendProgress] = useState<{ sent: number; total: number; errors: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'MEM' | 'EC' | 'CC' | 'JC'>('MEM')
  const [editReg, setEditReg] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false)

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

  // Get unique departments from builders
  const departments = useMemo(() => {
    const depts = new Set<string>()
    builders.forEach(b => {
      if (b.department) depts.add(b.department)
    })
    return Array.from(depts).sort()
  }, [builders])

  const filteredBuilders = useMemo(() => {
    let filtered = builders
    // Filter by type
    if (filterType !== 'ALL') {
      filtered = filtered.filter(b => b.type === filterType)
    }
    // Filter by department
    if (filterDepartment !== 'ALL') {
      filtered = filtered.filter(b => b.department === filterDepartment)
    }
    
    // Sort: Type first (EC, CC, JC, MEM), then Department, then Builder Number
    // Type order: EC -> CC -> JC -> MEM
    const typeOrder = { 'EC': 1, 'CC': 2, 'JC': 3, 'MEM': 4 }
    
    return filtered.sort((a, b) => {
      // First sort by type
      const typeA = typeOrder[a.type as keyof typeof typeOrder] || 999
      const typeB = typeOrder[b.type as keyof typeof typeOrder] || 999
      if (typeA !== typeB) {
        return typeA - typeB
      }
      
      // Then sort by department (for EC, CC, JC types)
      // Members with same department should be grouped together
      if (a.type !== 'MEM' && b.type !== 'MEM') {
        const deptA = a.department || ''
        const deptB = b.department || ''
        if (deptA !== deptB) {
          // Sort departments alphabetically, but empty/null departments go to end
          if (!deptA && deptB) return 1
          if (deptA && !deptB) return -1
          if (!deptA && !deptB) return 0
          return deptA.localeCompare(deptB)
        }
      }
      
      // Finally sort by builder number within same type and department
      return a.builder_number - b.builder_number
    })
  }, [builders, filterType, filterDepartment])

  const generateDownloadDescription = () => {
    if (filterType === 'ALL' && filterDepartment === 'ALL') {
      return 'All builders (all types, all departments)'
    }
    if (filterType === 'ALL' && filterDepartment !== 'ALL') {
      return `All builders from ${filterDepartment} department`
    }
    if (filterType !== 'ALL' && filterDepartment === 'ALL') {
      const typeName = filterType === 'MEM' ? 'Member' : 
                      filterType === 'EC' ? 'Executive Committee' : 
                      filterType === 'CC' ? 'Core Committee' : 
                      filterType === 'JC' ? 'Junior Committee' : filterType
      return `All ${typeName} (${filterType}) members`
    }
    // Both filters applied
    const typeName = filterType === 'MEM' ? 'Member' : 
                    filterType === 'EC' ? 'Executive Committee' : 
                    filterType === 'CC' ? 'Core Committee' : 
                    filterType === 'JC' ? 'Junior Committee' : filterType
    return `${typeName} (${filterType}) from ${filterDepartment} department`
  }

  const onDownloadData = async () => {
    setShowDownloadConfirm(false)
    
    const typeLabel = filterType === 'ALL' ? 'All Types' : filterType
    const typeFullName = filterType === 'ALL' ? 'All Types' : 
                        filterType === 'MEM' ? 'Member' :
                        filterType === 'EC' ? 'Executive Committee' :
                        filterType === 'CC' ? 'Core Committee' :
                        filterType === 'JC' ? 'Junior Committee' : filterType

    // Build title with department if filtered
    let titleText = `${typeFullName} Builder List`
    if (filterDepartment !== 'ALL') {
      titleText = `${typeFullName} - ${filterDepartment} Builder List`
    }

    // Load logo as base64
    const logoDataUrl = await loadLogoAsBase64()

    const doc = new jsPDF('landscape', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    // Store logo data for use in callbacks
    let logoInfo = { dataUrl: logoDataUrl, width: 50, height: 0, x: 0, titleY: 25 }
    
    // Calculate logo dimensions
    try {
      if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
        const logoWidth = 50 // mm
        const img = document.createElement('img')
        await new Promise<void>((resolve) => {
          img.onload = () => {
            const aspectRatio = img.height / img.width
            logoInfo.height = logoWidth * aspectRatio
            logoInfo.x = (pageWidth - logoWidth) / 2
            logoInfo.titleY = 15 + logoInfo.height + 8
            resolve()
          }
          img.onerror = () => resolve()
          img.src = logoDataUrl
        })
      }
    } catch (e) {
      console.error('Failed to calculate logo dimensions:', e)
    }
    
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
    const glassGreen: [number, number, number] = [24, 165, 143] // Medium teal-green for glass effect

    // Calculate table start position
    // First page has logo/title, subsequent pages start from top
    const firstPageTableStartY = logoInfo.titleY + 10
    const subsequentPageTableStartY = 15 // Top margin for pages 2+
    
    // Draw background and header on first page before table
    doc.setFillColor(15, 116, 99) // #0f7463
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    
    // Add logo on first page
    if (logoInfo.dataUrl && logoInfo.dataUrl.startsWith('data:image')) {
      try {
        doc.addImage(logoInfo.dataUrl, 'PNG', logoInfo.x, 10, logoInfo.width, logoInfo.height)
      } catch (e) {
        console.error('Failed to add logo:', e)
      }
    }
    
    // Add title on first page
    doc.setTextColor(255, 255, 255) // White text
    doc.setFontSize(26)
    doc.setFont('helvetica', 'bold')
    const titleWidth = doc.getTextWidth(titleText)
    doc.text(titleText, (pageWidth - titleWidth) / 2, logoInfo.titleY)
    
    // Add table with consistent dark green glass styling
    autoTable(doc, {
      head: [['Name', 'Builder Number', 'Registration Number', 'Email', 'Department', 'Email Sent Date']],
      body: tableData,
      startY: firstPageTableStartY,
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
      margin: { top: 15, left: 10, right: 10, bottom: 15 },
      showHead: 'everyPage', // Show header on every page
      showFoot: 'never',
      tableWidth: 'auto',
      didDrawPage: function(data: any) {
        // This callback runs after each page is drawn
        // For pages after the first, we need to ensure background exists
        const pageNum = data.pageNumber
        
        // For pages 2+, draw background using PDF content stream manipulation
        if (pageNum > 1) {
          try {
            const internal = (doc as any).internal
            if (internal && internal.pages && internal.pages[pageNum - 1]) {
              const page = internal.pages[pageNum - 1]
              if (page && Array.isArray(page) && page.length > 2) {
                const bgR = 15 / 255
                const bgG = 116 / 255
                const bgB = 99 / 255
                const bgColorStr = `${bgR} ${bgG} ${bgB} rg`
                const bgStream = `q\n${bgColorStr}\n0 0 ${pageWidth} ${pageHeight} re\nf\nQ\n`
                
                // Check if background already exists
                const content = page[2]
                let hasBg = false
                if (typeof content === 'string') {
                  hasBg = content.includes(bgColorStr)
                } else if (Array.isArray(content)) {
                  hasBg = content.some((c: any) => 
                    typeof c === 'string' && c.includes(bgColorStr)
                  )
                }
                
                // Prepend background to content stream if missing
                if (!hasBg) {
                  if (typeof content === 'string') {
                    page[2] = bgStream + content
                  } else if (Array.isArray(content)) {
                    page[2].unshift(bgStream)
                  } else {
                    page[2] = bgStream
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error adding background in didDrawPage:', e)
          }
        }
      }
    })
    
    // Final pass: Ensure all pages have background using internal PDF API
    // This is a backup to ensure backgrounds are definitely present
    try {
      const internal = (doc as any).internal
      if (internal && internal.pages) {
        const bgR = 15 / 255
        const bgG = 116 / 255
        const bgB = 99 / 255
        const bgColorStr = `${bgR} ${bgG} ${bgB} rg`
        const bgStream = `q\n${bgColorStr}\n0 0 ${pageWidth} ${pageHeight} re\nf\nQ\n`
        
        for (let i = 0; i < internal.pages.length; i++) {
          const page = internal.pages[i]
          if (page && Array.isArray(page) && page.length > 2) {
            const content = page[2]
            let hasBg = false
            
            if (typeof content === 'string') {
              hasBg = content.includes(bgColorStr)
              if (!hasBg) {
                page[2] = bgStream + content
              }
            } else if (Array.isArray(content)) {
              hasBg = content.some((c: any) => 
                typeof c === 'string' && c.includes(bgColorStr)
              )
              if (!hasBg) {
                page[2].unshift(bgStream)
              }
            } else if (!content) {
              page[2] = bgStream
            }
          }
        }
      }
    } catch (e) {
      console.error('Error in final background pass:', e)
    }

    // Generate filename
    let filename = typeLabel.toLowerCase()
    if (filterDepartment !== 'ALL') {
      filename += `-${filterDepartment.toLowerCase().replace(/\s+/g, '-')}`
    }
    filename += '-builder-list.pdf'

    // Save PDF
    doc.save(filename)
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

  const sendBulkEmails = async (type: 'EC' | 'CC' | 'JC') => {
    // Get all builders of this type who have email addresses
    const allBuildersWithEmail = builders.filter(b => 
      b.type === type && 
      b.email && 
      b.email.trim() !== ''
    )

    if (allBuildersWithEmail.length === 0) {
      alert(`No ${type} members with email addresses found.`)
      return
    }

    // Check if any have already received emails
    const alreadySent = allBuildersWithEmail.filter(b => b.email_sent_at)
    if (alreadySent.length > 0) {
      if (!confirm(`${alreadySent.length} ${type} member(s) have already received emails. Send to all ${allBuildersWithEmail.length} ${type} members anyway?`)) {
        return
      }
    } else {
      if (!confirm(`Send emails to ${allBuildersWithEmail.length} ${type} member(s)?`)) {
        return
      }
    }

    const buildersToEmail = allBuildersWithEmail

    setBulkSendingType(type)
    setBulkSendProgress({ sent: 0, total: buildersToEmail.length, errors: 0 })

    let sent = 0
    let errors = 0

    for (const builder of buildersToEmail) {
      if (!builder.id || !builder.email) continue

      try {
        const dataUrl = await renderCardAsDataUrl(builder.name, builder.builder_number, builder.type || 'MEM')
        const base64 = dataUrl.split(',')[1]
        const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#000000;">
<h1 style="font-size:28px;font-weight:700;margin:0 0 20px 0;">Welcome to BUILDIT 🎉</h1>

<p style="font-size:18px;margin:0 0 10px 0;">Hi ${builder.name},</p>

<p style="font-size:18px;margin:0 0 30px 0;">Congratulations! You're now an official BUILDIT member. Your exclusive builder card is ready!</p>

<p style="font-size:16px;margin:0 0 40px 0;">Your builder card image is attached to this email. Please download and save it to your device.</p>

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
<p style="font-size:16px;margin:0 0 40px 0;color:#333333;">This card is unique to you (Builder #${builder.type || 'MEM'}${builder.builder_number}). Please do not share your card with anyone else. Keep it secure and present it at events to avail your benefits.</p>

<h2 style="font-size:24px;font-weight:700;margin:40px 0 20px 0;color:#000000;">Verify Your Card</h2>
<p style="font-size:16px;margin:0 0 10px 0;color:#333333;">Scan the QR code on your card or visit:</p>
<p style="font-size:16px;margin:0 0 40px 0;"><a href="${typeof window !== 'undefined' ? window.location.origin : ''}/verify?builder=${encodeURIComponent(builder.builder_number)}&type=${encodeURIComponent(builder.type || 'MEM')}" style="color:#0000EE;text-decoration:underline;">${typeof window !== 'undefined' ? window.location.origin : ''}/verify?builder=${encodeURIComponent(builder.builder_number)}&type=${encodeURIComponent(builder.type || 'MEM')}</a></p>

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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: builder.email,
            subject: `Your BUILDIT Builder Card (${builder.type || 'MEM'}${builder.builder_number})`,
            html,
            attachmentName: `builder-${builder.type || 'MEM'}${builder.builder_number}.png`,
            attachmentBase64: base64,
            builderId: builder.id
          })
        })

        if (res.ok) {
          sent++
        } else {
          errors++
          console.error(`Failed to send email to ${builder.name} (${builder.email}):`, await res.json().catch(() => ({})))
        }
      } catch (err: any) {
        errors++
        console.error(`Error sending email to ${builder.name}:`, err)
      }

      // Update progress
      setBulkSendProgress({ sent, total: buildersToEmail.length, errors })

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Refresh builders list to update email_sent_at timestamps
    fetchBuilders()

    // Show completion message
    if (errors === 0) {
      alert(`Successfully sent emails to ${sent} ${type} member(s)!`)
    } else {
      alert(`Sent emails to ${sent} ${type} member(s). ${errors} error(s) occurred.`)
    }

    setBulkSendingType(null)
    setBulkSendProgress(null)
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
          onChange={e => {
            setFilterType(e.target.value as 'ALL' | 'MEM' | 'CC' | 'JC')
            // Reset department filter when type changes to MEM (MEM has no departments)
            if (e.target.value === 'MEM') {
              setFilterDepartment('ALL')
            }
          }}
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
        {(filterType === 'EC' || filterType === 'CC' || filterType === 'JC' || filterType === 'ALL') && (
          <select 
            value={filterDepartment} 
            onChange={e => setFilterDepartment(e.target.value)}
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
            <option value="ALL" style={{ background: '#0f7463', color: 'white' }}>All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept} style={{ background: '#0f7463', color: 'white' }}>{dept}</option>
            ))}
          </select>
        )}
        <button 
          onClick={() => setShowDownloadConfirm(true)} 
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
        {/* Bulk Email Buttons */}
        <button
          onClick={() => sendBulkEmails('EC')}
          disabled={!!bulkSendingType || builders.filter(b => b.type === 'EC' && b.email).length === 0}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: bulkSendingType === 'EC' ? 'rgba(21, 208, 170, 0.5)' : 'rgba(21, 208, 170, 0.3)',
            color: 'white',
            cursor: bulkSendingType || builders.filter(b => b.type === 'EC' && b.email).length === 0 ? 'not-allowed' : 'pointer',
            opacity: bulkSendingType || builders.filter(b => b.type === 'EC' && b.email).length === 0 ? 0.6 : 1,
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {bulkSendingType === 'EC' ? (
            <>
              <Loader2 size={16} className="spin" />
              {bulkSendProgress && `Sending... ${bulkSendProgress.sent}/${bulkSendProgress.total}`}
            </>
          ) : (
            `📧 Email All EC (${builders.filter(b => b.type === 'EC' && b.email).length})`
          )}
        </button>
        <button
          onClick={() => sendBulkEmails('CC')}
          disabled={!!bulkSendingType || builders.filter(b => b.type === 'CC' && b.email).length === 0}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: bulkSendingType === 'CC' ? 'rgba(21, 208, 170, 0.5)' : 'rgba(21, 208, 170, 0.3)',
            color: 'white',
            cursor: bulkSendingType || builders.filter(b => b.type === 'CC' && b.email).length === 0 ? 'not-allowed' : 'pointer',
            opacity: bulkSendingType || builders.filter(b => b.type === 'CC' && b.email).length === 0 ? 0.6 : 1,
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {bulkSendingType === 'CC' ? (
            <>
              <Loader2 size={16} className="spin" />
              {bulkSendProgress && `Sending... ${bulkSendProgress.sent}/${bulkSendProgress.total}`}
            </>
          ) : (
            `📧 Email All CC (${builders.filter(b => b.type === 'CC' && b.email).length})`
          )}
        </button>
        <button
          onClick={() => sendBulkEmails('JC')}
          disabled={!!bulkSendingType || builders.filter(b => b.type === 'JC' && b.email).length === 0}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: bulkSendingType === 'JC' ? 'rgba(21, 208, 170, 0.5)' : 'rgba(21, 208, 170, 0.3)',
            color: 'white',
            cursor: bulkSendingType || builders.filter(b => b.type === 'JC' && b.email).length === 0 ? 'not-allowed' : 'pointer',
            opacity: bulkSendingType || builders.filter(b => b.type === 'JC' && b.email).length === 0 ? 0.6 : 1,
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {bulkSendingType === 'JC' ? (
            <>
              <Loader2 size={16} className="spin" />
              {bulkSendProgress && `Sending... ${bulkSendProgress.sent}/${bulkSendProgress.total}`}
            </>
          ) : (
            `📧 Email All JC (${builders.filter(b => b.type === 'JC' && b.email).length})`
          )}
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
                        <option value="Directors" style={{ background: '#0f7463', color: 'white' }}>Directors</option>
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
     <p style="font-size:16px;margin:0 0 40px 0;"><a href="${window.location.origin}/verify?builder=${encodeURIComponent(b.builder_number)}&type=${encodeURIComponent(b.type || 'MEM')}" style="color:#0000EE;text-decoration:underline;">${window.location.origin}/verify?builder=${encodeURIComponent(b.builder_number)}&type=${encodeURIComponent(b.type || 'MEM')}</a></p>

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
              <a href={`/verify?builder=${previewNum}&type=${encodeURIComponent(previewType)}`} target="_blank" rel="noreferrer" style={{ textAlign: 'center', display: 'block', padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none' }}>Open Verification Page</a>
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

      {showDownloadConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1004, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setShowDownloadConfirm(false)} />
          <div style={{
            background: 'rgba(21, 208, 170, 0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: 32,
            width: '100%',
            maxWidth: 500,
            position: 'relative',
            zIndex: 1005
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Download Builder List</h2>
            <div style={{ margin: '0 0 24px 0', fontSize: 15, lineHeight: 1.8 }}>
              <p style={{ margin: '0 0 12px 0' }}>
                <strong>You are about to download:</strong>
              </p>
              <p style={{ margin: '0 0 8px 0', padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                {generateDownloadDescription()}
              </p>
              <p style={{ margin: '12px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                Total records: <strong>{filteredBuilders.length}</strong>
              </p>
            </div>
            <div className="hstack" style={{ gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDownloadConfirm(false)} style={{ padding: '8px 16px' }}>Cancel</button>
              <button onClick={onDownloadData} style={{ padding: '8px 16px', background: 'rgba(21, 208, 170, 0.3)' }}>Download PDF</button>
            </div>
          </div>
        </div>
      )}
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
        // Include type in verification URL for accurate lookup
        const verifyUrl = origin
          ? new URL(`/verify?builder=${encodeURIComponent(number)}&type=${encodeURIComponent(type)}`, origin).toString()
          : `/verify?builder=${encodeURIComponent(number)}&type=${encodeURIComponent(type)}`
        
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



