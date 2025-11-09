import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const type = searchParams.get('type')

  if (!type || !['MEM', 'EC', 'CC', 'JC'].includes(type)) {
    return NextResponse.json({ error: 'type is required and must be MEM, EC, CC, or JC' }, { status: 400 })
  }

  // Find the maximum builder_number for this type
  const { data: maxRows, error: maxErr } = await supabase
    .from('builders')
    .select('builder_number')
    .eq('type', type)
    .order('builder_number', { ascending: false })
    .limit(1)

  if (maxErr) {
    return NextResponse.json({ error: maxErr.message }, { status: 500 })
  }

  // Next number is max + 1, or 1 if no builders exist for this type
  const nextNumber = (maxRows?.[0]?.builder_number || 0) + 1

  return NextResponse.json({ nextNumber })
}

