import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, type, registration_number, email, builder_number, department } = body || {}
  const id = params.id

  // Get current builder to check existing values
  const { data: current } = await supabase
    .from('builders')
    .select('type, builder_number, department')
    .eq('id', id)
    .single()

  // If type or builder_number is being changed, check for duplicates
  if (type !== undefined || builder_number !== undefined) {
    const newType = type !== undefined ? type : current?.type
    const newNumber = builder_number !== undefined ? builder_number : current?.builder_number
    
    if (newType && newNumber !== undefined) {
      const { data: existing, error: checkErr } = await supabase
        .from('builders')
        .select('id, name')
        .eq('type', newType)
        .eq('builder_number', newNumber)
        .neq('id', id) // Exclude current builder
        .limit(1)
      
      if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 })
      if (existing && existing.length > 0) {
        return NextResponse.json({ 
          error: `Builder number ${newType}${newNumber} already exists for ${existing[0].name}`,
          duplicate: true
        }, { status: 409 })
      }
    }
  }

  // Validate department based on type
  const newType = type !== undefined ? type : current?.type
  if (department !== undefined || type !== undefined) {
    if (newType === 'MEM') {
      if (department) {
        return NextResponse.json({ error: 'Members (MEM type) cannot have a department' }, { status: 400 })
      }
    } else {
      // EC, CC, JC must have a department
      const finalDepartment = department !== undefined ? department : current?.department
      if (!finalDepartment) {
        return NextResponse.json({ error: `Department is required for ${newType} (${newType === 'EC' ? 'Executive Committee' : newType === 'CC' ? 'Core Committee' : 'Junior Committee'}) members` }, { status: 400 })
      }
      // Validate department value if provided
      if (department !== undefined) {
        const validDepartments = ['Finance', 'Production', 'Media & Design', 'Human Resources', 'Technical Projects', 'Technical Communication', 'Project Development', 'Logistics']
        if (!validDepartments.includes(department)) {
          return NextResponse.json({ error: 'Invalid department. Must be one of: ' + validDepartments.join(', ') }, { status: 400 })
        }
      }
    }
  }

  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (type !== undefined) updates.type = type
  if (builder_number !== undefined) updates.builder_number = builder_number
  if (registration_number !== undefined) updates.registration_number = registration_number || null
  if (email !== undefined) updates.email = email || null
  if (department !== undefined) {
    updates.department = newType !== 'MEM' ? (department || null) : null
  } else if (type !== undefined && newType === 'MEM') {
    // If type is being changed to MEM, clear department
    updates.department = null
  }

  const { data, error } = await supabase
    .from('builders')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ builder: data })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = params.id

  const { error } = await supabase
    .from('builders')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

