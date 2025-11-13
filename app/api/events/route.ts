import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventType = searchParams.get('type')
  const status = searchParams.get('status')
  
  let query = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (eventType) {
    query = query.eq('event_type', eventType)
  }
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { event_name, event_type, start_time, end_time, notes } = body || {}
  
  if (!event_name || !event_type || !start_time || !end_time) {
    return NextResponse.json({ error: 'event_name, event_type, start_time, and end_time are required' }, { status: 400 })
  }
  
  const validEventTypes = ['desk_setup', 'night', 'perm', 'gbm']
  if (!validEventTypes.includes(event_type)) {
    return NextResponse.json({ error: `event_type must be one of: ${validEventTypes.join(', ')}` }, { status: 400 })
  }
  
  // Validate that end_time is after start_time
  const start = new Date(start_time)
  const end = new Date(end_time)
  if (end <= start) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
  }
  
  const { data, error } = await supabase
    .from('events')
    .insert({
      event_name,
      event_type,
      start_time,
      end_time,
      notes: notes || null,
      status: 'draft'
    })
    .select('*')
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}

