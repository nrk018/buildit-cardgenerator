// Web Crypto API compatible functions for Edge Runtime

// Get secret key bytes from environment (hashed for consistent length)
async function getSecretKeyBytes(): Promise<Uint8Array> {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'default-secret-change-in-production'
  // Use a hash of the secret to ensure consistent length (32 bytes for SHA-256)
  const encoder = new TextEncoder()
  const data = encoder.encode(secret)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hashBuffer)
}

// Generate random bytes using Web Crypto API
function generateRandomBytes(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

// Create HMAC signature using Web Crypto API
async function createHMAC(message: string): Promise<string> {
  const keyBytes = await getSecretKeyBytes()
  const encoder = new TextEncoder()
  const messageData = encoder.encode(message)
  
  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  // Sign the message
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Timing-safe string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Generate a secure session token
export async function generateSessionToken(): Promise<string> {
  const timestamp = Date.now()
  const randomBytes = generateRandomBytes(16)
  
  // Create token: timestamp|random|signature
  const payload = `${timestamp}|${randomBytes}`
  
  // Create HMAC signature
  const signature = await createHMAC(payload)
  
  // Return: timestamp|random|signature
  return `${payload}|${signature}`
}

// Validate and verify a session token
export async function validateSessionToken(token: string): Promise<{ valid: boolean; expired: boolean; timestamp?: number }> {
  try {
    const parts = token.split('|')
    
    if (parts.length !== 3) {
      return { valid: false, expired: false }
    }
    
    const [timestampStr, random, signature] = parts
    const timestamp = parseInt(timestampStr, 10)
    
    if (isNaN(timestamp)) {
      return { valid: false, expired: false }
    }
    
    // Verify signature
    const payload = `${timestampStr}|${random}`
    const expectedSignature = await createHMAC(payload)
    
    // Use timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(signature, expectedSignature)) {
      return { valid: false, expired: false }
    }
    
    // Check expiration (6 hours)
    const sessionDuration = 6 * 60 * 60 * 1000 // 6 hours in milliseconds
    const now = Date.now()
    const expired = (now - timestamp) > sessionDuration
    
    if (expired) {
      return { valid: true, expired: true, timestamp }
    }
    
    return { valid: true, expired: false, timestamp }
  } catch (error) {
    return { valid: false, expired: false }
  }
}

// Check if token format is valid (basic structure check)
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('|')
  return parts.length === 3 && parts[0].length > 0 && parts[1].length > 0 && parts[2].length > 0
}

