import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  const { to, subject, html, attachmentName, attachmentBase64, builderId } = await req.json()
  if (!to) return NextResponse.json({ error: 'missing to' }, { status: 400 })

  // Try Resend API first (recommended - easier setup)
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || 'BUILD IT <onboarding@resend.dev>'

  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey)
      const attachments = attachmentBase64 && attachmentName ? [{
        filename: attachmentName,
        content: Buffer.from(attachmentBase64, 'base64')
      }] : []

      await resend.emails.send({
        from: fromEmail,
        to,
        subject: subject || 'Your BUILD IT Builder Card',
        html: html || '',
        attachments: attachments.length > 0 ? attachments : undefined
      })

      // Track email sent in database
      if (builderId) {
        try {
          const { error } = await supabase
            .from('builders')
            .update({ 
              email_sent_at: new Date().toISOString()
            })
            .eq('id', builderId)
          if (error) console.error('Failed to update email sent:', error)
        } catch (err) {
          console.error('Failed to update email sent:', err)
        }
      }

      return NextResponse.json({ ok: true, provider: 'resend' })
    } catch (error: any) {
      console.error('Resend error:', error)
      // Fall through to SMTP if Resend fails
    }
  }

  // Fallback to SMTP (for SendGrid, Gmail, etc.)
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass || !fromEmail) {
    return NextResponse.json({ 
      error: 'Email config missing. Set RESEND_API_KEY (recommended) or SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL)' 
    }, { status: 500 })
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })

  const attachments = attachmentBase64 && attachmentName ? [{ filename: attachmentName, content: Buffer.from(attachmentBase64, 'base64') }] : []

  try {
    await transporter.sendMail({ from: fromEmail, to, subject: subject || 'Your BUILD IT Builder Card', html: html || '', attachments })
    
    // Track email sent in database
    if (builderId) {
      try {
        const { error } = await supabase
          .from('builders')
          .update({ 
            email_sent_at: new Date().toISOString()
          })
          .eq('id', builderId)
        if (error) console.error('Failed to update email sent:', error)
      } catch (err) {
        console.error('Failed to update email sent:', err)
      }
    }
    
    return NextResponse.json({ ok: true, provider: 'smtp' })
  } catch (error: any) {
    console.error('SMTP error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send email', details: error.response }, { status: 500 })
  }
}



