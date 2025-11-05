import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(_: Request, { params }: { params: { builder: string } }) {
  const builderNum = Number(params.builder)
  if (Number.isNaN(builderNum)) {
    return NextResponse.json({ valid: false, error: 'Invalid builder number' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .eq('builder_number', builderNum)
    .maybeSingle()
  if (error) return NextResponse.json({ valid: false, error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: true, builder: data })
}


