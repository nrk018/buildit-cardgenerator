import './globals.css'
import React from 'react'
import { ClientWrapper } from '@/components/ClientWrapper'

export const metadata = {
  title: 'BUILD IT - Builder ID Cards',
  description: 'Generate BUILD IT club builder ID cards with QR verification'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  )
}


