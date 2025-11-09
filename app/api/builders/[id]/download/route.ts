import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  // Handle both Next.js 14 (async params) and Next.js 13 (sync params)
  const resolvedParams = await Promise.resolve(params)
  const id = resolvedParams.id
  const { data, error } = await supabase
    .from('builders')
    .update({ downloaded_at: new Date().toISOString(), download_count: (null as any) })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    // Attempt without download_count in case column doesn't exist
    const fallback = await supabase
      .from('builders')
      .update({ downloaded_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    return NextResponse.json({ builder: fallback.data })
  }
  return NextResponse.json({ builder: data })
}


