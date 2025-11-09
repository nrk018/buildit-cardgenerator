import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .order('type', { ascending: true })
    .order('department', { ascending: true, nullsFirst: false })
    .order('builder_number', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Additional client-side sorting to ensure proper order:
  // EC first, then CC, then JC, then MEM
  // Within each type, group by department, then by builder number
  const typeOrder = { 'EC': 1, 'CC': 2, 'JC': 3, 'MEM': 4 }
  const sorted = (data || []).sort((a, b) => {
    // First sort by type (EC, CC, JC, MEM)
    const typeA = typeOrder[a.type as keyof typeof typeOrder] || 999
    const typeB = typeOrder[b.type as keyof typeof typeOrder] || 999
    if (typeA !== typeB) {
      return typeA - typeB
    }
    
    // Then sort by department (for EC, CC, JC types)
    // Group members by department, even if builder numbers are different
    if (a.type !== 'MEM' && b.type !== 'MEM') {
      const deptA = a.department || ''
      const deptB = b.department || ''
      if (deptA !== deptB) {
        // Sort departments alphabetically, but empty/null departments go to end
        if (!deptA && deptB) return 1
        if (deptA && !deptB) return -1
        if (!deptA && !deptB) return 0
        return deptA.localeCompare(deptB)
      }
    }
    
    // Finally sort by builder number within same type and department
    return a.builder_number - b.builder_number
  })
  
  return NextResponse.json({ builders: sorted })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, builder_number, type, registration_number, email, department } = body || {}

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (!type || !['MEM', 'EC', 'CC', 'JC'].includes(type)) {
    return NextResponse.json({ error: 'type is required and must be MEM, EC, CC, or JC' }, { status: 400 })
  }

  // Validate department: required for EC, CC, JC; not allowed for MEM
  if (type === 'MEM') {
    if (department) {
      return NextResponse.json({ error: 'Members (MEM type) cannot have a department' }, { status: 400 })
    }
  } else {
    // EC, CC, JC must have a department
    if (!department) {
      return NextResponse.json({ error: `Department is required for ${type} (${type === 'EC' ? 'Executive Committee' : type === 'CC' ? 'Core Committee' : 'Junior Committee'}) members` }, { status: 400 })
    }
    // Validate department value
    const validDepartments = ['Finance', 'Production', 'Media & Design', 'Human Resources', 'Technical Projects', 'Technical Communication', 'Project Development', 'Logistics', 'Directors']
    if (!validDepartments.includes(department)) {
      return NextResponse.json({ error: 'Invalid department. Must be one of: ' + validDepartments.join(', ') }, { status: 400 })
    }
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
    .insert({ 
      name, 
      builder_number: targetNumber, 
      type, 
      registration_number: registration_number || null, 
      email: email || null,
      department: type !== 'MEM' ? (department || null) : null
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ builder: data })
}


