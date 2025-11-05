import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths
  const isPublic = (
    pathname.startsWith('/verify') ||
    pathname.startsWith('/api/verify') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/public')
  )

  if (isPublic) return NextResponse.next()

  const needsAuth = (
    pathname === '/' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/builders')
  )

  if (!needsAuth) return NextResponse.next()

  const cookie = request.cookies.get('admin_session')?.value
  if (cookie === 'yes') return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!.*\.).*)']
}


