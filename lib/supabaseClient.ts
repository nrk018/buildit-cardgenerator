import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!url || !key) {
    throw new Error('Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY) and restart the dev server.')
  }
  cached = createClient(url, key)
  return cached
}

export const supabase = getSupabase()

export type BuilderRecord = {
  id: string
  builder_number: number
  type: string
  name: string
  registration_number: string | null
  email: string | null
  department: string | null
  created_at: string
  downloaded_at: string | null
  download_count?: number | null
  email_sent_at: string | null
}

export type MemberType = 'MEM' | 'EC' | 'CC' | 'JC'

export type Department = 'Finance' | 'Production' | 'Media & Design' | 'Human Resources' | 'Technical Projects' | 'Technical Communication' | 'Project Development' | 'Logistics'


