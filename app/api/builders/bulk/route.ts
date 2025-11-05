import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { records } = body || {}
  if (!Array.isArray(records)) {
    return NextResponse.json({ error: 'records must be an array' }, { status: 400 })
  }

  // Determine next number for any records missing one
  const { data: maxRows, error: maxErr } = await supabase
    .from('builders')
    .select('builder_number')
    .order('builder_number', { ascending: false })
    .limit(1)
  if (maxErr) return NextResponse.json({ error: maxErr.message }, { status: 500 })
  let nextNum = (maxRows?.[0]?.builder_number || 0) + 1

  const rows = records.map((r: any) => {
    const name = String(r.name || r.student || '').trim()
    const type = r.type || r.member_type || 'MEM'
    if (!['MEM', 'EC', 'CC', 'JC'].includes(type)) {
      return null
    }
    let num = r.builder_number ?? r.number
    const reg = r.registration_number || r.reg_no || r.reg || null
    const email = r.email || r.mail || null
    if (num === undefined || num === null || num === '') {
      // For bulk, we'll need to handle per-type auto-increment, but for simplicity use a global counter
      // This could be improved to track per-type
      num = nextNum++
    }
    return { name, builder_number: Number(num), type, registration_number: reg, email }
  }).filter(r => r && r.name)

  const { data, error } = await supabase
    .from('builders')
    .insert(rows)
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ builders: data })
}


