import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const id = resolvedParams.id
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  
  return NextResponse.json({ event: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const id = resolvedParams.id
  const body = await req.json()
  const { event_name, event_type, start_time, end_time, status, notes } = body || {}
  
  const updates: any = {}
  if (event_name !== undefined) updates.event_name = event_name
  if (event_type !== undefined) {
    const validEventTypes = ['desk_setup', 'night', 'perm', 'gbm']
    if (!validEventTypes.includes(event_type)) {
      return NextResponse.json({ error: `event_type must be one of: ${validEventTypes.join(', ')}` }, { status: 400 })
    }
    updates.event_type = event_type
  }
  if (start_time !== undefined) updates.start_time = start_time
  if (end_time !== undefined) updates.end_time = end_time
  if (status !== undefined) updates.status = status
  if (notes !== undefined) updates.notes = notes
  
  // Validate timing if both are provided
  if (start_time !== undefined && end_time !== undefined) {
    const start = new Date(start_time)
    const end = new Date(end_time)
    if (end <= start) {
      return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
    }
  }
  
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const id = resolvedParams.id
  
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

