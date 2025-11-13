import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// Get attendance records for an event
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const eventId = resolvedParams.id
  
  const { data, error } = await supabase
    .from('attendance_records')
    .select(`
      *,
      builders (
        id,
        name,
        builder_number,
        type,
        department
      )
    `)
    .eq('event_id', eventId)
    .order('time_slot_start', { ascending: true })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data || [] })
}

// Mark attendance (present/absent)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const eventId = resolvedParams.id
  const body = await req.json()
  const { builder_id, time_slot_start, status, notes } = body || {}
  
  if (!builder_id || !time_slot_start || !status) {
    return NextResponse.json({ error: 'builder_id, time_slot_start, and status are required' }, { status: 400 })
  }
  
  if (status !== 'present' && status !== 'absent') {
    return NextResponse.json({ error: 'status must be "present" or "absent"' }, { status: 400 })
  }
  
  // Use upsert to update if record exists, or insert if it doesn't
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert({
      event_id: eventId,
      builder_id,
      time_slot_start,
      status,
      notes: notes || null
    }, {
      onConflict: 'event_id,builder_id,time_slot_start'
    })
    .select(`
      *,
      builders (
        id,
        name,
        builder_number,
        type,
        department
      )
    `)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data })
}

// Batch mark attendance
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const eventId = resolvedParams.id
  const body = await req.json()
  const { records } = body || {}
  
  if (!Array.isArray(records)) {
    return NextResponse.json({ error: 'records must be an array' }, { status: 400 })
  }
  
  const recordsToUpsert = records.map((record: any) => ({
    event_id: eventId,
    builder_id: record.builder_id,
    time_slot_start: record.time_slot_start,
    status: record.status,
    notes: record.notes || null
  }))
  
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(recordsToUpsert, {
      onConflict: 'event_id,builder_id,time_slot_start'
    })
    .select(`
      *,
      builders (
        id,
        name,
        builder_number,
        type,
        department
      )
    `)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data || [] })
}

