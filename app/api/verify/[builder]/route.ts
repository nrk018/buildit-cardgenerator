import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(req: NextRequest, { params }: { params: Promise<{ builder: string }> | { builder: string } }) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')?.toUpperCase()
  // Handle both Next.js 14 (async params) and Next.js 13 (sync params)
  const resolvedParams = await Promise.resolve(params)
  const builderParam = resolvedParams.builder
  
  // Try to parse builder number from the parameter
  // It could be just a number, or it could be in format "EC1", "CC1", etc.
  let builderNum: number | null = null
  let parsedType: string | null = null
  
  // First, try to parse as a number directly
  builderNum = Number(builderParam)
  if (Number.isNaN(builderNum)) {
    // If not a number, try to parse format like "EC1", "CC1", etc.
    const match = builderParam.match(/^([A-Z]+)(\d+)$/i)
    if (match) {
      parsedType = match[1].toUpperCase()
      builderNum = Number(match[2])
    } else {
      return NextResponse.json({ valid: false, error: 'Invalid builder number format' }, { status: 400 })
    }
  }
  
  if (builderNum === null || Number.isNaN(builderNum)) {
    return NextResponse.json({ valid: false, error: 'Invalid builder number' }, { status: 400 })
  }
  
  // Use type from query parameter if provided, otherwise use parsed type from builder param
  const finalType = type || parsedType
  
  // Build query
  let query = supabase
    .from('builders')
    .select('*')
    .eq('builder_number', builderNum)
  
  // If type is provided, filter by type as well (required for uniqueness)
  if (finalType) {
    if (!['MEM', 'EC', 'CC', 'JC'].includes(finalType)) {
      return NextResponse.json({ valid: false, error: 'Invalid builder type' }, { status: 400 })
    }
    query = query.eq('type', finalType)
  }
  
  const { data, error } = await query.maybeSingle()
  
  if (error) return NextResponse.json({ valid: false, error: error.message }, { status: 500 })
  if (!data) {
    // If no type was provided and no result found, it might be ambiguous
    // Try to find any builder with that number (for backward compatibility)
    if (!finalType) {
      const { data: anyBuilder, error: anyError } = await supabase
        .from('builders')
        .select('*')
        .eq('builder_number', builderNum)
        .maybeSingle()
      
      if (anyError) return NextResponse.json({ valid: false, error: anyError.message }, { status: 500 })
      if (anyBuilder) {
        return NextResponse.json({ valid: true, builder: anyBuilder })
      }
    }
    return NextResponse.json({ valid: false })
  }
  
  return NextResponse.json({ valid: true, builder: data })
}


