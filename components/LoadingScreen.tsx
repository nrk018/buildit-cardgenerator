"use client"

import Image from 'next/image'
import { Loader } from '@/components/ui/loader'
import logoImage from '@/components/logobuildit.png'

export default function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f7463',
      gap: '32px',
      padding: '24px',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      <Image 
        src={logoImage} 
        alt="BUILDIT Logo" 
        width={200} 
        height={67} 
        style={{ 
          height: 'auto', 
          width: 'auto', 
          maxWidth: '300px',
          objectFit: 'contain' 
        }} 
        priority
      />
      <Loader />
    </div>
  )
}

