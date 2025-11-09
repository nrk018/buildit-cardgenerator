"use client"
import React, { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

type Props = {
  studentName: string
  builderNumber: number
  type?: string
  width?: number
  height?: number
  onReady?: (dataUrl: string) => void
  className?: string
  style?: React.CSSProperties
}

// Renders a 1200x675 landscape card by default (16:9) with gradient, brand, text and QR
export default function CardCanvas({ studentName, builderNumber, type = 'MEM', width = 1200, height = 675, onReady, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background gradient inspired by provided design
    const draw = async () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, '#18c5a6')
      grad.addColorStop(0.4, '#11a58d')
      grad.addColorStop(1, '#0b6f62')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // soft vignettes
      const vignette = ctx.createRadialGradient(canvas.width * 0.9, canvas.height * 0.25, 50, canvas.width, 0, canvas.width)
      vignette.addColorStop(0, 'rgba(255,255,255,0.15)')
      vignette.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = vignette
      ctx.beginPath()
      ctx.arc(canvas.width * 0.9, canvas.height * 0.25, canvas.height * 0.55, 0, Math.PI * 2)
      ctx.fill()

      // left BUILD IT rail
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(40, 0, 14, canvas.height)

      // Title
      ctx.fillStyle = 'white'
      ctx.font = '900 86px Inter, ui-sans-serif, system-ui'
      ctx.textBaseline = 'top'
      wrapText(ctx, 'WELCOME TO THE CLUB BUILDER!', 120, 70, canvas.width * 0.6, 90)

      ctx.font = '600 28px Inter, ui-sans-serif, system-ui'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText("Let's build something that matters", 120, 70 + 90 * 3 + 12)

      // Labels and fields (aligned by a fixed label column and vertically centered text)
      const labelTop = canvas.height - 230
      drawField(ctx, 'STUDENT NAME', studentName, 120, labelTop, canvas.width * 0.58)
      drawField(ctx, 'BUILDER NUMBER', `${type}${builderNumber}`, 120, labelTop + 96, canvas.width * 0.58)

      // QR code at right
      const qrSize = 230
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      // Include type in verification URL for accurate lookup
      const verifyUrl = origin
        ? new URL(`/verify?builder=${encodeURIComponent(builderNumber)}&type=${encodeURIComponent(type)}`, origin).toString()
        : `/verify?builder=${encodeURIComponent(builderNumber)}&type=${encodeURIComponent(type)}`
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: qrSize })
      const img = new Image()
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.src = qrDataUrl
      })
      ctx.drawImage(img, canvas.width - qrSize - 80, canvas.height - qrSize - 80, qrSize, qrSize)

      // Footer URL
      ctx.font = '600 22px Inter, ui-sans-serif, system-ui'
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.fillText('builditmuj.club', canvas.width - 300, canvas.height - 30)

      const dataUrl = canvas.toDataURL('image/png')
      onReady?.(dataUrl)
    }

    draw()
  }, [studentName, builderNumber, type, width, height, onReady])

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className={className || "card-surface"}
      style={{
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        ...style
      }}
    />
  )
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  words.forEach((w, i) => {
    const test = line ? line + ' ' + w : w
    const metrics = ctx.measureText(test)
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, cy)
      line = w
      cy += lineHeight
    } else {
      line = test
    }
  })
  if (line) ctx.fillText(line, x, cy)
}

function drawField(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number) {
  const LABEL_COL = 340
  const FIELD_H = 64
  const RADIUS = 18
  const fieldX = x + LABEL_COL
  const fieldY = y
  const centerY = fieldY + FIELD_H / 2
  const fieldW = Math.max(300, width - LABEL_COL)

  // Label (vertically centered with input)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.9)'
  ctx.font = '800 32px Inter, ui-sans-serif, system-ui'
  const labelText = `${label} :`
  ctx.fillText(labelText, x, centerY)

  // Input surface
  roundRect(ctx, fieldX, fieldY, fieldW, FIELD_H, RADIUS)
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  ctx.fill()

  // Value text (also centered vertically)
  ctx.fillStyle = '#11423c'
  ctx.font = '700 30px Inter, ui-sans-serif, system-ui'
  ctx.fillText(value, fieldX + 18, centerY)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}


