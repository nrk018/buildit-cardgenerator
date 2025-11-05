import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: 'password required' }, { status: 400 })
  const expected = process.env.ADMIN_PASSWORD || ''
  if (!expected) return NextResponse.json({ error: 'server missing ADMIN_PASSWORD' }, { status: 500 })
  if (password !== expected) return NextResponse.json({ ok: false }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', 'yes', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 6 // 6 hours
  })
  return res
}


