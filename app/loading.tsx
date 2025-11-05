"use client"

import Image from 'next/image'
import { Loader } from '@/components/ui/loader'
import logoImage from '@/components/logobuildit.png'

export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f7463',
      gap: '32px',
      padding: '24px'
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

