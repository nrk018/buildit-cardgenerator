import { NextRequest, NextResponse } from 'next/server'
import { generateSessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: 'password required' }, { status: 400 })
  const expected = process.env.ADMIN_PASSWORD || ''
  if (!expected) return NextResponse.json({ error: 'server missing ADMIN_PASSWORD' }, { status: 500 })
  if (password !== expected) return NextResponse.json({ ok: false }, { status: 401 })

  // Generate secure session token
  const sessionToken = await generateSessionToken()

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 6 // 6 hours
  })
  return res
}


