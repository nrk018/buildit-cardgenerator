import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateSessionToken, isValidTokenFormat } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths
  const isPublic = (
    pathname.startsWith('/verify') ||
    pathname.startsWith('/api/verify') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api/admin/login') ||
    pathname.startsWith('/api/admin/logout')
  )
  
  if (isPublic) return NextResponse.next()

  // Protected paths that need auth
  const needsAuth = (
    pathname === '/' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/attendance') ||
    pathname.startsWith('/api/builders') ||
    pathname.startsWith('/api/events') ||
    pathname.startsWith('/api/email')
  )

  if (!needsAuth) return NextResponse.next()

  // Validate session token
  const cookie = request.cookies.get('admin_session')?.value
  
  // Check if token exists and has valid format
  if (!cookie || !isValidTokenFormat(cookie)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Validate token signature and expiration (async)
  const validation = await validateSessionToken(cookie)
  
  if (!validation.valid || validation.expired) {
    // Clear invalid/expired cookie
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    const response = NextResponse.redirect(url)
    response.cookies.set('admin_session', '', { path: '/', maxAge: 0 })
    return response
  }

  // Token is valid and not expired
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\.).*)']
}


