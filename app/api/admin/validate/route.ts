import { NextRequest, NextResponse } from 'next/server'
import { validateSessionToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('admin_session')?.value
  
  if (!cookie) {
    return NextResponse.json({ valid: false, expired: false }, { status: 401 })
  }

  const validation = await validateSessionToken(cookie)
  
  if (!validation.valid) {
    return NextResponse.json({ valid: false, expired: false }, { status: 401 })
  }

  if (validation.expired) {
    return NextResponse.json({ valid: true, expired: true }, { status: 401 })
  }

  return NextResponse.json({ valid: true, expired: false })
}

