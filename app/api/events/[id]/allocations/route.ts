import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// Get all allocations for an event
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const eventId = resolvedParams.id
  
  const { data, error } = await supabase
    .from('event_allocations')
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
    .order('section', { ascending: true })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ allocations: data || [] })
}

// Create or update allocations for an event
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params)
  const eventId = resolvedParams.id
  const body = await req.json()
  const { allocations } = body || {}
  
  if (!Array.isArray(allocations)) {
    return NextResponse.json({ error: 'allocations must be an array' }, { status: 400 })
  }
  
  // Validate allocations
  for (const alloc of allocations) {
    if (!alloc.builder_id || !alloc.time_slot_start || !alloc.time_slot_end) {
      return NextResponse.json({ error: 'Each allocation must have builder_id, time_slot_start, and time_slot_end' }, { status: 400 })
    }
  }
  
  // Deduplicate allocations based on (builder_id, time_slot_start)
  // Normalize time_slot_start to ISO string to ensure consistent comparison
  const uniqueAllocationsMap = new Map<string, any>()
  for (const alloc of allocations) {
    if (!alloc.builder_id || !alloc.time_slot_start || !alloc.time_slot_end) {
      continue // Skip invalid allocations
    }
    
    // Normalize time_slot_start to ISO string for consistent comparison
    let normalizedStart: string
    try {
      normalizedStart = new Date(alloc.time_slot_start).toISOString()
    } catch (e) {
      console.error('Invalid time_slot_start:', alloc.time_slot_start, e)
      continue
    }
    
    const key = `${alloc.builder_id}_${normalizedStart}`
    // Keep the first occurrence
    if (!uniqueAllocationsMap.has(key)) {
      uniqueAllocationsMap.set(key, {
        ...alloc,
        time_slot_start: normalizedStart,
        time_slot_end: new Date(alloc.time_slot_end).toISOString()
      })
    }
  }
  const uniqueAllocations = Array.from(uniqueAllocationsMap.values())
  
  if (uniqueAllocations.length === 0) {
    // If no allocations, delete all existing and return empty
    const { error: deleteError } = await supabase
      .from('event_allocations')
      .delete()
      .eq('event_id', eventId)
    
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }
    
    return NextResponse.json({ allocations: [] })
  }
  
  // Prepare allocations for upsert - ensure all required fields are present and normalized
  const allocationsToUpsert = uniqueAllocations.map((alloc: any) => {
    // Validate and normalize all fields
    const builderId = String(alloc.builder_id).trim()
    let timeSlotStart: string
    let timeSlotEnd: string
    
    try {
      timeSlotStart = new Date(alloc.time_slot_start).toISOString()
      timeSlotEnd = new Date(alloc.time_slot_end).toISOString()
    } catch (e) {
      throw new Error(`Invalid date format: ${alloc.time_slot_start} or ${alloc.time_slot_end}`)
    }
    
    const section = alloc.section ? String(alloc.section).trim() : null
    
    if (!builderId || !timeSlotStart || !timeSlotEnd) {
      throw new Error(`Invalid allocation: builder_id=${builderId}, time_slot_start=${timeSlotStart}, time_slot_end=${timeSlotEnd}`)
    }
    
    return {
      event_id: eventId,
      builder_id: builderId,
      time_slot_start: timeSlotStart,
      time_slot_end: timeSlotEnd,
      section: section
    }
  })
  
  // Final deduplication pass - remove any remaining duplicates
  const finalUniqueMap = new Map<string, typeof allocationsToUpsert[0]>()
  for (const alloc of allocationsToUpsert) {
    const key = `${alloc.builder_id}_${alloc.time_slot_start}`
    if (!finalUniqueMap.has(key)) {
      finalUniqueMap.set(key, alloc)
    }
  }
  const finalAllocations = Array.from(finalUniqueMap.values())
  
  // Strategy: Delete all existing allocations for this event, then insert new ones
  // This ensures we don't have stale allocations and avoids constraint issues
  
  // First, count existing allocations
  const { count: existingCount } = await supabase
    .from('event_allocations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
  
  if (existingCount && existingCount > 0) {
    console.log(`Deleting ${existingCount} existing allocations for event ${eventId}`)
    
    // Delete all existing allocations
    const { error: deleteError } = await supabase
      .from('event_allocations')
      .delete()
      .eq('event_id', eventId)
    
    if (deleteError) {
      console.error('Error deleting existing allocations:', deleteError)
      return NextResponse.json({ error: `Failed to delete existing allocations: ${deleteError.message}` }, { status: 500 })
    }
    
    // Verify deletion completed by checking if any allocations remain
    const { count: remainingCount } = await supabase
      .from('event_allocations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
    
    if (remainingCount && remainingCount > 0) {
      console.warn(`Warning: ${remainingCount} allocations still exist after delete. Retrying delete...`)
      // Retry delete
      const { error: retryDeleteError } = await supabase
        .from('event_allocations')
        .delete()
        .eq('event_id', eventId)
      
      if (retryDeleteError) {
        return NextResponse.json({ error: `Failed to delete existing allocations on retry: ${retryDeleteError.message}` }, { status: 500 })
      }
    } else {
      console.log(`Successfully deleted all ${existingCount} existing allocations`)
    }
  } else {
    console.log('No existing allocations to delete')
  }
  
  // Now insert the new allocations
  // Insert in batches to avoid potential size limits
  const batchSize = 100
  const allResults: any[] = []
  
  for (let i = 0; i < finalAllocations.length; i += batchSize) {
    const batch = finalAllocations.slice(i, i + batchSize)
    
    // Verify no duplicates in batch (triple check)
    const batchKeys = new Set<string>()
    const deduplicatedBatch = batch.filter(alloc => {
      // Normalize the key to ensure consistency
      const normalizedStart = new Date(alloc.time_slot_start).toISOString()
      const key = `${alloc.builder_id}_${normalizedStart}`
      if (batchKeys.has(key)) {
        console.warn('Duplicate in batch skipped:', key, alloc)
        return false
      }
      batchKeys.add(key)
      // Ensure time_slot_start is properly normalized
      alloc.time_slot_start = normalizedStart
      alloc.time_slot_end = new Date(alloc.time_slot_end).toISOString()
      return true
    })
    
    if (deduplicatedBatch.length === 0) {
      console.log(`Batch ${Math.floor(i / batchSize) + 1} is empty after deduplication, skipping`)
      continue
    }
    
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} with ${deduplicatedBatch.length} allocations`)
    
    const { data, error } = await supabase
      .from('event_allocations')
      .insert(deduplicatedBatch)
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
    
    if (error) {
      console.error('Error inserting batch:', error)
      console.error('Batch size:', deduplicatedBatch.length)
      console.error('Batch sample (first 3):', JSON.stringify(deduplicatedBatch.slice(0, 3), null, 2))
      
      // Check if it's a duplicate key error
      if (error.message && error.message.includes('duplicate key')) {
        // Log all keys in the batch to help debug
        const batchKeysList = deduplicatedBatch.map(a => `${a.builder_id}_${a.time_slot_start}`)
        console.error('Duplicate keys in batch:', batchKeysList)
        
        // Try to find which specific allocation is duplicate
        for (const alloc of deduplicatedBatch) {
          const { data: existing } = await supabase
            .from('event_allocations')
            .select('*')
            .eq('event_id', eventId)
            .eq('builder_id', alloc.builder_id)
            .eq('time_slot_start', alloc.time_slot_start)
            .limit(1)
          
          if (existing && existing.length > 0) {
            console.error('Found existing duplicate allocation:', existing[0])
          }
        }
      }
      
      return NextResponse.json({ 
        error: `Failed to insert allocations: ${error.message}`,
        details: error,
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: deduplicatedBatch.length,
        hint: error.message.includes('duplicate key') ? 'Duplicate key violation. This may indicate a race condition or incomplete deletion.' : undefined
      }, { status: 500 })
    }
    
    if (data) {
      allResults.push(...data)
      console.log(`Successfully inserted ${data.length} allocations in batch ${Math.floor(i / batchSize) + 1}`)
    }
  }
  
  console.log(`Successfully saved ${allResults.length} total allocations for event ${eventId}`)
  return NextResponse.json({ allocations: allResults })
}

