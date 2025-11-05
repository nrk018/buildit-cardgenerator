import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .order('type', { ascending: true })
    .order('builder_number', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ builders: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, builder_number, type, registration_number, email } = body || {}

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (!type || !['MEM', 'EC', 'CC', 'JC'].includes(type)) {
    return NextResponse.json({ error: 'type is required and must be MEM, EC, CC, or JC' }, { status: 400 })
  }

  let targetNumber = builder_number as number | undefined

  if (targetNumber === undefined || targetNumber === null) {
    // auto-increment by finding max for this type
    const { data: maxRows, error: maxErr } = await supabase
      .from('builders')
      .select('builder_number')
      .eq('type', type)
      .order('builder_number', { ascending: false })
      .limit(1)
    if (maxErr) return NextResponse.json({ error: maxErr.message }, { status: 500 })
    targetNumber = (maxRows?.[0]?.builder_number || 0) + 1
  } else {
    // Check if this builder_number + type combination already exists
    const { data: existing, error: checkErr } = await supabase
      .from('builders')
      .select('id, name')
      .eq('type', type)
      .eq('builder_number', targetNumber)
      .limit(1)
    if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 })
    if (existing && existing.length > 0) {
      return NextResponse.json({ 
        error: `Builder number ${type}${targetNumber} already exists for ${existing[0].name}`,
        duplicate: true,
        existingBuilder: existing[0]
      }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('builders')
    .insert({ name, builder_number: targetNumber, type, registration_number: registration_number || null, email: email || null })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ builder: data })
}


