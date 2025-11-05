"use client"

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import LoadingScreen from './LoadingScreen'

const MIN_LOADING_TIME = 3000 // 3 seconds - one full animation cycle

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const loadingStartTime = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // When pathname changes, ensure minimum loading time
    if (loadingStartTime.current) {
      const elapsed = Date.now() - loadingStartTime.current
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Set timeout to hide loading after minimum time
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false)
        loadingStartTime.current = null
      }, remaining)
    } else {
      // If no loading was started, just hide immediately
      setIsLoading(false)
    }
  }, [pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      
      if (anchor) {
        const href = anchor.getAttribute('href')
        // Check if it's an internal link
        if (href && href.startsWith('/') && !href.startsWith('/api') && !href.includes('#')) {
          const currentPath = window.location.pathname
          // Check if it's a different route
          if (href !== currentPath) {
            loadingStartTime.current = Date.now()
            setIsLoading(true)
          }
        }
      }
    }

    // Use capture phase to catch clicks early
    document.addEventListener('click', handleClick, true)
    
    return () => {
      document.removeEventListener('click', handleClick, true)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Also handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      loadingStartTime.current = Date.now()
      setIsLoading(true)
      setTimeout(() => {
        setIsLoading(false)
        loadingStartTime.current = null
      }, MIN_LOADING_TIME)
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      {isLoading && <LoadingScreen />}
      {children}
    </>
  )
}

