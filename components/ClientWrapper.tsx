"use client"

import { LoadingProvider } from './LoadingProvider'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return <LoadingProvider>{children}</LoadingProvider>
}

