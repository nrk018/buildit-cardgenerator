"use client"
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle, Plus, Trash2, Download } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import logoImage from '@/components/logobuildit.png'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type Builder = {
  id: string
  name: string
  builder_number: number
  type: string
  department: string | null
}

type Event = {
  id: string
  event_name: string
  event_type: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  created_at: string
}

type TimeSlot = {
  start: Date
  end: Date
  section: string
}

type Allocation = {
  id?: string
  builder_id: string
  time_slot_start: string
  time_slot_end: string
  section: string
  builder?: Builder
}

export default function AttendancePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [builders, setBuilders] = useState<Builder[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventType, setSelectedEventType] = useState<'desk_setup' | 'night' | 'perm' | 'gbm'>('desk_setup')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [eventName, setEventName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [savingAllocations, setSavingAllocations] = useState(false)
  const [viewMode, setViewMode] = useState<'create' | 'allocate' | 'allotment' | 'attendance' | 'attendance-view'>('create')
  const [selectedDepartmentsBySlot, setSelectedDepartmentsBySlot] = useState<Record<number, string>>({})
  const [confirmedSlots, setConfirmedSlots] = useState<Set<number>>(new Set())
  const [editingSlots, setEditingSlots] = useState<Set<number>>(new Set())
  const [eventAllocationsMap, setEventAllocationsMap] = useState<Record<string, Allocation[]>>({})
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, { status: 'present' | 'absent', notes?: string }>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [attendanceViewFilter, setAttendanceViewFilter] = useState<'all' | 'present' | 'absent'>('all')
  const [editingEventDate, setEditingEventDate] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [eventStartTime, setEventStartTime] = useState('')
  const [eventEndTime, setEventEndTime] = useState('')
  const [updatingEventDate, setUpdatingEventDate] = useState(false)

  // Fetch builders (EC and CC only)
  const fetchBuilders = async () => {
    const res = await fetch('/api/builders')
    const json = await res.json()
    const ecAndCc = (json.builders || []).filter((b: Builder) => b.type === 'EC' || b.type === 'CC')
    setBuilders(ecAndCc)
  }

  // Fetch events
  const fetchEvents = async () => {
    const res = await fetch(`/api/events?type=${selectedEventType}`)
    const json = await res.json()
    const eventsList = json.events || []
    setEvents(eventsList)
    
    // Fetch allocations for all events to show in the event list
    const allocationsMap: Record<string, Allocation[]> = {}
    for (const event of eventsList) {
      try {
        const allocRes = await fetch(`/api/events/${event.id}/allocations`)
        if (allocRes.ok) {
          const allocJson = await allocRes.json()
          const mappedAllocations = (allocJson.allocations || []).map((alloc: any) => {
            let builderData = null
            if (alloc.builders) {
              builderData = alloc.builders
            } else if (alloc.builder_id) {
              builderData = builders.find(b => b.id === alloc.builder_id)
            }
            return {
              id: alloc.id,
              builder_id: alloc.builder_id,
              time_slot_start: alloc.time_slot_start,
              time_slot_end: alloc.time_slot_end,
              section: alloc.section || 'desk_1',
              builder: builderData
            }
          })
          allocationsMap[event.id] = mappedAllocations
        }
      } catch (error) {
        console.error(`Failed to fetch allocations for event ${event.id}:`, error)
        allocationsMap[event.id] = []
      }
    }
    setEventAllocationsMap(allocationsMap)
  }

  // Fetch allocations for selected event
  const fetchAllocations = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/allocations`)
      if (!res.ok) {
        throw new Error('Failed to fetch allocations')
      }
      const json = await res.json()
      // Map allocations to match our Allocation type
      // Supabase returns builders as a nested object, not an array
      const mappedAllocations = (json.allocations || []).map((alloc: any) => {
        // Handle both nested builder object and builder_id
        let builderData = null
        if (alloc.builders) {
          // Supabase returns builders as a single object when using select with nested relation
          builderData = alloc.builders
        } else if (alloc.builder_id) {
          // Fallback to finding builder from our builders list
          builderData = builders.find(b => b.id === alloc.builder_id)
        }
        
        return {
          id: alloc.id,
          builder_id: alloc.builder_id,
          time_slot_start: alloc.time_slot_start,
          time_slot_end: alloc.time_slot_end,
          section: alloc.section || 'desk_1',
          builder: builderData
        }
      })
      console.log('Fetched allocations:', mappedAllocations.length, 'allocations with builders')
      setAllocations(mappedAllocations)
    } catch (error) {
      console.error('Failed to fetch allocations:', error)
      setAllocations([])
    }
  }, [builders])

  // Fetch attendance records for selected event
  const fetchAttendanceRecords = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/attendance`)
      if (!res.ok) {
        throw new Error('Failed to fetch attendance records')
      }
      const json = await res.json()
      const recordsMap: Record<string, { status: 'present' | 'absent', notes?: string }> = {}
      ;(json.attendance || []).forEach((record: any) => {
        if (record.builder_id && record.time_slot_start) {
          // Normalize time_slot_start to ISO string for consistent key generation
          try {
            const normalizedTime = new Date(record.time_slot_start).toISOString()
            const key = `${record.builder_id}_${normalizedTime}`
            recordsMap[key] = {
              status: record.status,
              notes: record.notes || undefined
            }
          } catch (e) {
            console.error('Error normalizing time_slot_start:', e, record)
          }
        }
      })
      setAttendanceRecords(recordsMap)
    } catch (error) {
      console.error('Failed to fetch attendance records:', error)
      setAttendanceRecords({})
    }
  }, [])

  // Mark attendance for a member in a slot
  const handleMarkAttendance = useCallback((builderId: string, slot: TimeSlot, status: 'present' | 'absent') => {
    const slotStartTime = new Date(slot.start).getTime()
    
    // Find the allocation for this builder in this slot to get the exact time_slot_start
    const slotAllocation = allocations.find(a => {
      if (a.builder_id !== builderId) return false
      if (!a.time_slot_start) return false
      try {
        const allocStartTime = new Date(a.time_slot_start).getTime()
        const timeDiff = Math.abs(allocStartTime - slotStartTime)
        return timeDiff < 1000
      } catch (e) {
        return false
      }
    })
    
    // Use allocation's time_slot_start if available, otherwise use slot's start time
    // Normalize to ISO string for consistent key generation
    let timeSlotStart: string
    if (slotAllocation?.time_slot_start) {
      try {
        timeSlotStart = new Date(slotAllocation.time_slot_start).toISOString()
      } catch (e) {
        timeSlotStart = slot.start.toISOString()
      }
    } else {
      timeSlotStart = slot.start.toISOString()
    }
    
    setAttendanceRecords(prev => {
      // Find existing key that matches this builder and time slot (within 1 second tolerance)
      let matchingKey: string | null = null
      const timeSlotStartTime = new Date(timeSlotStart).getTime()
      
      for (const key of Object.keys(prev)) {
        const [keyBuilderId, timeStr] = key.split('_')
        if (keyBuilderId === builderId && timeStr) {
          try {
            const recordTime = new Date(timeStr).getTime()
            if (Math.abs(recordTime - timeSlotStartTime) < 1000) {
              matchingKey = key
              break
            }
          } catch (e) {
            // Ignore invalid dates
          }
        }
      }
      
      // Use matching key if found, otherwise create new key with normalized time_slot_start
      const key = matchingKey || `${builderId}_${timeSlotStart}`
      
      return {
        ...prev,
        [key]: {
          ...prev[key],
          status,
          // Preserve notes if they exist
          notes: prev[key]?.notes
        }
      }
    })
  }, [allocations])

  // Save attendance records
  const handleSaveAttendance = useCallback(async () => {
    if (!selectedEvent) return
    
    // Get current slot allocations if in attendance view
    let slotsToSave: TimeSlot[] = []
    if (selectedSlotIndex !== null && timeSlots[selectedSlotIndex]) {
      slotsToSave = [timeSlots[selectedSlotIndex]]
    } else {
      // If no slot selected, save all slots
      slotsToSave = timeSlots
    }
    
    setSavingAttendance(true)
    try {
      const recordsToSave: Array<{
        builder_id: string
        time_slot_start: string
        status: 'present' | 'absent'
        notes?: string | null
      }> = []
      
      // For each slot, find allocations and check attendance records
      slotsToSave.forEach(slot => {
        const slotStartTime = new Date(slot.start).getTime()
        const slotAllocations = allocations.filter(a => {
          if (!a.time_slot_start) return false
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            return timeDiff < 1000
          } catch (e) {
            return false
          }
        })
        
        slotAllocations.forEach(alloc => {
          // Try multiple key formats to match attendance records
          const allocStartTime = new Date(alloc.time_slot_start).getTime()
          const slotStartISO = slot.start.toISOString()
          const allocStartISO = alloc.time_slot_start
          
          // Try different key formats
          const keys = [
            `${alloc.builder_id}_${slotStartISO}`,
            `${alloc.builder_id}_${allocStartISO}`,
            `${alloc.builder_id}_${new Date(allocStartTime).toISOString()}`
          ]
          
          // Find matching attendance record
          let attendanceRecord = null
          for (const key of keys) {
            if (attendanceRecords[key]) {
              attendanceRecord = attendanceRecords[key]
              break
            }
          }
          
          // Also check if times match (within 1 second tolerance)
          if (!attendanceRecord) {
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            if (timeDiff < 1000) {
              // Check all attendance records for this builder
              Object.entries(attendanceRecords).forEach(([key, record]) => {
                const [builderId, timeStr] = key.split('_')
                if (builderId === alloc.builder_id && timeStr) {
                  try {
                    const recordTime = new Date(timeStr).getTime()
                    if (Math.abs(recordTime - slotStartTime) < 1000) {
                      attendanceRecord = record
                    }
                  } catch (e) {
                    // Ignore invalid dates
                  }
                }
              })
            }
          }
          
          if (attendanceRecord && attendanceRecord.status) {
            // Normalize time_slot_start to ISO string for consistency
            let normalizedTime: string
            try {
              normalizedTime = new Date(alloc.time_slot_start).toISOString()
            } catch (e) {
              console.error('Error normalizing time_slot_start in handleSaveAttendance:', e, alloc)
              normalizedTime = alloc.time_slot_start // Fallback to original value
            }
            recordsToSave.push({
              builder_id: alloc.builder_id,
              time_slot_start: normalizedTime, // Use normalized time_slot_start
              status: attendanceRecord.status,
              notes: attendanceRecord.notes || null
            })
          }
        })
      })
      
      if (recordsToSave.length === 0) {
        alert('No attendance records to save. Please mark attendance for at least one member in the current slot.')
        setSavingAttendance(false)
        return
      }
      
      console.log('Saving attendance records:', recordsToSave)
      
      const res = await fetch(`/api/events/${selectedEvent.id}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: recordsToSave })
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to save attendance:', errorData)
        alert(`Failed to save attendance: ${errorData.error || res.statusText}`)
        setSavingAttendance(false)
        return
      }
      
      await fetchAttendanceRecords(selectedEvent.id)
      alert(`Attendance saved successfully for ${recordsToSave.length} member(s)!`)
    } catch (error: any) {
      console.error('Error saving attendance:', error)
      alert(`Failed to save attendance: ${error.message || 'Unknown error'}`)
    } finally {
      setSavingAttendance(false)
    }
  }, [selectedEvent, attendanceRecords, allocations, fetchAttendanceRecords, selectedSlotIndex, timeSlots])

  // Get attendance status for a builder in a slot
  const getAttendanceStatus = useCallback((builderId: string, slot: TimeSlot): 'present' | 'absent' | null => {
    const slotStartTime = new Date(slot.start).getTime()
    const slotStartISO = slot.start.toISOString()
    
    // Try exact match first
    const exactKey = `${builderId}_${slotStartISO}`
    if (attendanceRecords[exactKey]) {
      return attendanceRecords[exactKey].status
    }
    
    // Try matching by time (within 1 second tolerance)
    for (const [key, record] of Object.entries(attendanceRecords)) {
      const [recordBuilderId, timeStr] = key.split('_')
      if (recordBuilderId === builderId && timeStr) {
        try {
          const recordTime = new Date(timeStr).getTime()
          if (Math.abs(recordTime - slotStartTime) < 1000) {
            return record.status
          }
        } catch (e) {
          // Ignore invalid dates
        }
      }
    }
    
    return null
  }, [attendanceRecords])

  // Delete event
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return
    setDeletingEvent(true)
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        alert(`Failed to delete event: ${errorData.error || res.statusText}`)
        return
      }
      setSelectedEvent(null)
      setAllocations([])
      setTimeSlots([])
      setAttendanceRecords({})
      setViewMode('create')
      setShowDeleteConfirm(false)
      await fetchEvents()
      alert('Event deleted successfully!')
    } catch (error: any) {
      alert(`Failed to delete event: ${error.message}`)
    } finally {
      setDeletingEvent(false)
    }
  }

  // Update event date/time
  const handleUpdateEventDate = async () => {
    if (!selectedEvent) return
    
    // Validate inputs
    if (!eventDate || !eventStartTime || !eventEndTime) {
      alert('Please fill in all date and time fields')
      return
    }

    // Combine date and time
    const startDateTime = new Date(`${eventDate}T${eventStartTime}`)
    const endDateTime = new Date(`${eventDate}T${eventEndTime}`)

    // Validate that end is after start
    if (endDateTime <= startDateTime) {
      alert('End time must be after start time')
      return
    }

    setUpdatingEventDate(true)
    try {
      // Save current allocations and time slots before updating
      const oldAllocations = [...allocations]
      const oldTimeSlots = [...timeSlots]
      const oldEventStart = new Date(selectedEvent.start_time)
      const oldEventEnd = new Date(selectedEvent.end_time)

      // Update the event
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString()
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        alert(`Failed to update event: ${errorData.error || res.statusText}`)
        return
      }

      const json = await res.json()
      setSelectedEvent(json.event)
      setEditingEventDate(false)
      
      // Calculate new time slots directly (don't rely on async state update)
      const newStartDate = new Date(json.event.start_time)
      const newEndDate = new Date(json.event.end_time)
      const newTimeSlots: TimeSlot[] = []
      const slotDuration = 30 * 60 * 1000 // 30 minutes in milliseconds
      const totalDuration = newEndDate.getTime() - newStartDate.getTime()
      const minSlotDuration = slotDuration
      
      if (totalDuration < 60 * 60 * 1000) {
        // If less than 60 minutes, just create one logistics slot
        newTimeSlots.push({
          start: new Date(newStartDate),
          end: new Date(newEndDate),
          section: 'logistics'
        })
      } else {
        // First slot: Logistics Setup (first 30 minutes)
        const logisticsStartEnd = new Date(newStartDate.getTime() + slotDuration)
        newTimeSlots.push({
          start: new Date(newStartDate),
          end: new Date(logisticsStartEnd),
          section: 'logistics_setup'
        })
        
        // Generate 30-minute desk slots between logistics
        let currentTime = new Date(logisticsStartEnd)
        let slotIndex = 1
        const logisticsEndStart = new Date(newEndDate.getTime() - slotDuration)
        
        while (currentTime < logisticsEndStart) {
          const slotEnd = new Date(currentTime.getTime() + slotDuration)
          const actualEnd = slotEnd > logisticsEndStart ? logisticsEndStart : slotEnd
          
          if (actualEnd > currentTime && (actualEnd.getTime() - currentTime.getTime()) >= minSlotDuration / 2) {
            newTimeSlots.push({
              start: new Date(currentTime),
              end: new Date(actualEnd),
              section: `desk_${slotIndex}`
            })
            currentTime = new Date(actualEnd)
            slotIndex++
          } else {
            break
          }
        }
        
        // Last slot: Logistics Cleanup (last 30 minutes)
        if (currentTime < newEndDate) {
          newTimeSlots.push({
            start: new Date(currentTime),
            end: new Date(newEndDate),
            section: 'logistics_cleanup'
          })
        }
      }
      
      // Set the new time slots
      setTimeSlots(newTimeSlots)
      
      // Map old allocations to new time slots
      // Strategy: Match allocations by their relative position in the time slots
      const newAllocations: Allocation[] = []
      
      oldAllocations.forEach((oldAlloc) => {
        if (!oldAlloc.time_slot_start) return
        
        // Find which old slot this allocation belonged to
        const oldSlotIndex = oldTimeSlots.findIndex((slot) => {
          const slotStartTime = new Date(slot.start).getTime()
          const allocStartTime = new Date(oldAlloc.time_slot_start).getTime()
          const timeDiff = Math.abs(allocStartTime - slotStartTime)
          return timeDiff < 1000 // 1 second tolerance
        })
        
        if (oldSlotIndex !== -1 && oldSlotIndex < newTimeSlots.length) {
          // Map to the corresponding new slot by index
          const newSlot = newTimeSlots[oldSlotIndex]
          newAllocations.push({
            ...oldAlloc,
            time_slot_start: newSlot.start.toISOString(),
            time_slot_end: newSlot.end.toISOString(),
            section: newSlot.section
          })
        }
      })
      
      // Update allocations state
      setAllocations(newAllocations)
      
      // Save updated allocations to database
      if (newAllocations.length > 0) {
        try {
          const allocRes = await fetch(`/api/events/${selectedEvent.id}/allocations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              allocations: newAllocations.map(a => ({
                builder_id: a.builder_id,
                time_slot_start: a.time_slot_start,
                time_slot_end: a.time_slot_end,
                section: a.section
              }))
            })
          })
          
          if (!allocRes.ok) {
            console.error('Failed to update allocations after date change')
            // Don't fail the whole operation, just log the error
          }
        } catch (error) {
          console.error('Error updating allocations:', error)
          // Don't fail the whole operation
        }
      }
      
      // Refresh events list
      await fetchEvents()
      
      alert('Event date/time updated successfully! Allocations have been preserved.')
    } catch (error: any) {
      alert(`Failed to update event: ${error.message}`)
    } finally {
      setUpdatingEventDate(false)
    }
  }

  useEffect(() => {
    // Validate session on mount - prevent rendering until confirmed
    const validateSession = async () => {
      const res = await fetch('/api/admin/validate', { credentials: 'include' })
      if (!res.ok) {
        window.location.href = '/login?next=/attendance'
        return
      }
      setIsAuthenticated(true)
      fetchBuilders()
    }
    validateSession()
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [selectedEventType, builders])

  useEffect(() => {
    if (selectedEvent) {
      fetchAllocations(selectedEvent.id)
      generateTimeSlots(selectedEvent.start_time, selectedEvent.end_time)
      if (viewMode === 'attendance' || viewMode === 'attendance-view') {
        fetchAttendanceRecords(selectedEvent.id)
      }
      // Reset selected slot when event changes
      setSelectedSlotIndex(null)
      
      // Initialize date/time fields
      if (selectedEvent.start_time && selectedEvent.end_time) {
        const startDate = new Date(selectedEvent.start_time)
        const endDate = new Date(selectedEvent.end_time)
        const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
        const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
        setEventDate(dateStr)
        setEventStartTime(startTimeStr)
        setEventEndTime(endTimeStr)
      }
    }
  }, [selectedEvent, fetchAllocations, viewMode, fetchAttendanceRecords])

  // Auto-select first slot if none selected and slots exist
  useEffect(() => {
    if (timeSlots.length > 0 && selectedSlotIndex === null && (viewMode === 'allocate' || viewMode === 'allotment' || viewMode === 'attendance')) {
      setSelectedSlotIndex(0)
    }
  }, [timeSlots.length, selectedSlotIndex, viewMode])

  // Generate time slots (30-minute intervals)
  const generateTimeSlots = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const slots: TimeSlot[] = []
    const slotDuration = 30 * 60 * 1000 // 30 minutes in milliseconds
    
    // Calculate total duration
    const totalDuration = endDate.getTime() - startDate.getTime()
    const minSlotDuration = slotDuration // Minimum 30 minutes for a slot
    
    // Need at least 60 minutes (30 for start logistics + 30 for end logistics)
    if (totalDuration < 60 * 60 * 1000) {
      // If less than 60 minutes, just create one logistics slot
      slots.push({
        start: new Date(startDate),
        end: new Date(endDate),
        section: 'logistics'
      })
      setTimeSlots(slots)
      return
    }
    
    // First slot: Logistics Setup (first 30 minutes)
    const logisticsStartEnd = new Date(startDate.getTime() + slotDuration)
    slots.push({
      start: new Date(startDate),
      end: new Date(logisticsStartEnd),
      section: 'logistics_setup'
    })
    
    // Generate 30-minute desk slots between logistics
    let currentTime = new Date(logisticsStartEnd)
    let slotIndex = 1
    const logisticsEndStart = new Date(endDate.getTime() - slotDuration) // 30 minutes before end
    
    // Add desk slots until we reach the last 30 minutes
    while (currentTime < logisticsEndStart) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration)
      const actualEnd = slotEnd > logisticsEndStart ? logisticsEndStart : slotEnd
      
      // Only add slot if it has at least some duration
      if (actualEnd > currentTime && (actualEnd.getTime() - currentTime.getTime()) >= minSlotDuration / 2) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(actualEnd),
          section: `desk_${slotIndex}`
        })
        currentTime = new Date(actualEnd)
        slotIndex++
      } else {
        break
      }
    }
    
    // Last slot: Logistics Cleanup (last 30 minutes)
    if (currentTime < endDate) {
      slots.push({
        start: new Date(currentTime),
        end: new Date(endDate),
        section: 'logistics_cleanup'
      })
    }
    
    setTimeSlots(slots)
  }

  // Helper function to get slot display name
  const getSlotName = useCallback((slot: TimeSlot, slotIndex: number) => {
    if (slot.section === 'logistics_setup') return 'Logistics (Setup)'
    if (slot.section === 'logistics_cleanup') return 'Logistics (Cleanup)'
    if (slot.section === 'logistics') return 'Logistics'
    return `Desk Slot ${slotIndex}`
  }, [])

  // Get EC and CC builders separately
  const ecBuilders = useMemo(() => builders.filter(b => b.type === 'EC'), [builders])
  const ccBuilders = useMemo(() => builders.filter(b => b.type === 'CC'), [builders])
  
  // Get unique departments from EC and CC builders
  const departments = useMemo(() => {
    const deptSet = new Set<string>()
    builders.forEach(b => {
      if (b.department && (b.type === 'EC' || b.type === 'CC')) {
        deptSet.add(b.department)
      }
    })
    return Array.from(deptSet).sort()
  }, [builders])
  
  // Get builders by department and type
  const getBuildersByDepartment = useCallback((dept: string, type: 'EC' | 'CC') => {
    return builders.filter(b => 
      b.department === dept && 
      b.type === type
    ).sort((a, b) => a.builder_number - b.builder_number)
  }, [builders])
  
  // Get all builders for a department (EC and CC combined)
  const getDepartmentBuilders = useCallback((dept: string) => {
    return builders.filter(b => 
      b.department === dept && 
      (b.type === 'EC' || b.type === 'CC')
    ).sort((a, b) => {
      // Sort by type first (EC before CC), then by builder number
      if (a.type !== b.type) {
        return a.type === 'EC' ? -1 : 1
      }
      return a.builder_number - b.builder_number
    })
  }, [builders])

  // Create event
  const handleCreateEvent = async () => {
    if (!eventName || !startTime || !endTime) {
      alert('Please fill in all fields')
      return
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    if (end <= start) {
      alert('End time must be after start time')
      return
    }

    setCreatingEvent(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventName,
          event_type: selectedEventType,
          start_time: start.toISOString(),
          end_time: end.toISOString()
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        alert(`Failed to create event: ${errorData.error || res.statusText}`)
        return
      }

      const json = await res.json()
      setSelectedEvent(json.event)
      setViewMode('allocate')
      setEventName('')
      setStartTime('')
      setEndTime('')
      fetchEvents()
    } catch (error: any) {
      alert(`Failed to create event: ${error.message}`)
    } finally {
      setCreatingEvent(false)
    }
  }

  // Allocate builder to time slot
  const handleAllocate = useCallback((builderId: string, slot: TimeSlot) => {
    const slotStartTime = new Date(slot.start).getTime()
    
    setAllocations(prevAllocations => {
      // Check if already allocated - use time-based comparison with tolerance
      const existingIndex = prevAllocations.findIndex(a => {
        if (a.builder_id !== builderId) return false
        if (!a.time_slot_start) return false
        try {
          const allocStartTime = new Date(a.time_slot_start).getTime()
          const timeDiff = Math.abs(allocStartTime - slotStartTime)
          return timeDiff < 1000 // 1 second tolerance
        } catch (e) {
          return false
        }
      })

      if (existingIndex !== -1) {
        // Remove allocation - create new array without this specific allocation
        console.log('Removing allocation:', prevAllocations[existingIndex])
        return prevAllocations.filter((_, index) => index !== existingIndex)
      } else {
        // Add allocation - but first check if it already exists to prevent duplicates
        const alreadyExists = prevAllocations.some(a => {
          if (a.builder_id !== builderId) return false
          if (!a.time_slot_start) return false
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            return timeDiff < 1000
          } catch (e) {
            return false
          }
        })
        if (alreadyExists) {
          return prevAllocations // Don't add duplicate
        }
        
        const builder = builders.find(b => b.id === builderId)
        if (!builder) return prevAllocations
        
        const newAllocation: Allocation = {
          builder_id: builderId,
          time_slot_start: slot.start.toISOString(),
          time_slot_end: slot.end.toISOString(),
          section: slot.section,
          builder
        }
        console.log('Adding allocation:', newAllocation)
        return [...prevAllocations, newAllocation]
      }
    })
  }, [builders])
  
  // Select all members from a department for a slot
  const handleSelectAllDepartment = useCallback((dept: string, slot: TimeSlot) => {
    const deptBuilders = getDepartmentBuilders(dept)
    const slotStart = slot.start.toISOString()
    
    setAllocations(prevAllocations => {
      // Check if all are already allocated
      const allocatedBuilders = prevAllocations
        .filter(a => a.time_slot_start === slotStart)
        .map(a => a.builder_id)
      
      const allAllocated = deptBuilders.length > 0 && deptBuilders.every(b => allocatedBuilders.includes(b.id))
      
      if (allAllocated) {
        // Deselect all from this department for this slot only
        return prevAllocations.filter(a => {
          // Keep allocations for other slots
          if (a.time_slot_start !== slotStart) return true
          // For this slot, keep only if builder is NOT from this department
          const builder = builders.find(b => b.id === a.builder_id)
          return builder?.department !== dept
        })
      } else {
        // Select all from this department
        // First, remove any existing allocations for this department in this slot
        const filtered = prevAllocations.filter(a => {
          if (a.time_slot_start !== slotStart) return true
          const builder = builders.find(b => b.id === a.builder_id)
          return builder?.department !== dept
        })
        
        // Add all department builders for this slot, but avoid duplicates
        const existingBuilderIds = new Set(
          filtered
            .filter(a => a.time_slot_start === slotStart)
            .map(a => a.builder_id)
        )
        
        const newAllocations = deptBuilders
          .filter(builder => !existingBuilderIds.has(builder.id))
          .map(builder => ({
            builder_id: builder.id,
            time_slot_start: slotStart,
            time_slot_end: slot.end.toISOString(),
            section: slot.section,
            builder
          }))
        
        return [...filtered, ...newAllocations]
      }
    })
  }, [getDepartmentBuilders, builders])

  // Save allocations
  const handleSaveAllocations = async () => {
    if (!selectedEvent) return
    
    // Prevent multiple simultaneous saves
    if (savingAllocations) {
      console.warn('Save already in progress, skipping...')
      return
    }

    setSavingAllocations(true)
    try {
      // Deduplicate allocations based on (builder_id, time_slot_start) before sending
      // Normalize time_slot_start to ISO string for consistent comparison
      const uniqueAllocationsMap = new Map<string, {
        builder_id: string
        time_slot_start: string
        time_slot_end: string
        section: string
      }>()
      
      // First pass: collect and normalize all allocations with proper error handling
      const normalizedAllocations = allocations
        .filter(a => {
          if (!a.builder_id || !a.time_slot_start || !a.time_slot_end) {
            console.warn('Skipping invalid allocation:', a)
            return false
          }
          return true
        })
        .map(a => {
          try {
            // Normalize dates to ISO strings for consistent comparison
            // Use Date object to ensure proper parsing
            const startDate = new Date(a.time_slot_start)
            const endDate = new Date(a.time_slot_end)
            
            // Validate dates are valid
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.warn('Invalid date in allocation:', a)
              return null
            }
            
            return {
              ...a,
              builder_id: String(a.builder_id).trim(),
              time_slot_start: startDate.toISOString(),
              time_slot_end: endDate.toISOString(),
              section: a.section || 'desk_1'
            }
          } catch (e) {
            console.error('Error normalizing allocation:', a, e)
            return null
          }
        })
        .filter((a): a is NonNullable<typeof a> => a !== null)
      
      // Second pass: deduplicate using normalized values
      normalizedAllocations.forEach(a => {
        const key = `${a.builder_id}_${a.time_slot_start}`
        if (!uniqueAllocationsMap.has(key)) {
          uniqueAllocationsMap.set(key, {
            builder_id: a.builder_id,
            time_slot_start: a.time_slot_start,
            time_slot_end: a.time_slot_end,
            section: a.section
          })
        } else {
          console.warn('Duplicate allocation detected and skipped:', { 
            builder_id: a.builder_id, 
            time_slot_start: a.time_slot_start,
            existing: uniqueAllocationsMap.get(key)
          })
        }
      })
      
      // Convert map values back to array
      const uniqueAllocations = Array.from(uniqueAllocationsMap.values())
      
      // Log for debugging
      if (uniqueAllocations.length !== allocations.length) {
        console.log(`Deduplicated ${allocations.length} allocations to ${uniqueAllocations.length} unique allocations`)
      }
      
      const res = await fetch(`/api/events/${selectedEvent.id}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: uniqueAllocations
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || errorData.details?.message || res.statusText
        console.error('Failed to save allocations:', errorData)
        alert(`Failed to save allocations: ${errorMessage}`)
        return
      }

      const json = await res.json()
      
      // Refetch allocations from the database to ensure we have the latest data with proper builder relationships
      if (selectedEvent) {
        await fetchAllocations(selectedEvent.id)
        // Also refresh the event list to update allocation counts
        await fetchEvents()
      }
      
      // Show confirmation status
      const confirmedCount = Array.from(confirmedSlots).length
      const totalSlots = timeSlots.length
      if (confirmedCount > 0) {
        alert(`Allocations saved successfully! ${confirmedCount}/${totalSlots} slots confirmed.`)
      } else {
        alert('Allocations saved successfully!')
      }
    } catch (error: any) {
      alert(`Failed to save allocations: ${error.message}`)
    } finally {
      setSavingAllocations(false)
    }
  }

  // Format time for display
  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  // Format date for input
  const formatDateTimeLocal = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Check if builder is allocated to slot
  const isAllocated = useCallback((builderId: string, slot: TimeSlot) => {
    const slotStart = slot.start.toISOString()
    return allocations.some(
      a => a.builder_id === builderId &&
      a.time_slot_start === slotStart
    )
  }, [allocations])

  // Get allocated builder for slot
  const getAllocatedBuilder = useCallback((slot: TimeSlot) => {
    const slotStartTime = new Date(slot.start).getTime()
    const allocated = allocations.filter(a => {
      if (!a.time_slot_start) return false
      try {
        const allocStartTime = new Date(a.time_slot_start).getTime()
        const timeDiff = Math.abs(allocStartTime - slotStartTime)
        return timeDiff < 1000 // 1 second tolerance
      } catch (e) {
        return false
      }
    })
    return allocated
      .map(a => {
        // Use builder from allocation if available, otherwise find from builders list
        return a.builder || builders.find(b => b.id === a.builder_id)
      })
      .filter(Boolean) as Builder[]
  }, [allocations, builders])

  // Load logo as base64 for PDF
  const loadLogoAsBase64 = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img')
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => {
        resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
      }
      img.src = typeof logoImage === 'string' ? logoImage : (logoImage as any).src || logoImage
    })
  }, [])

  // Download PDF with attendance records
  const handleDownloadAttendancePDF = useCallback(async () => {
    if (!selectedEvent) return

    try {
      // Fetch latest attendance records
      await fetchAttendanceRecords(selectedEvent.id)

      // Load logo
      const logoDataUrl = await loadLogoAsBase64()

      const doc = new jsPDF('portrait', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Store logo data for use in callbacks
      let logoInfo = { dataUrl: logoDataUrl, width: 50, height: 0, x: 0, titleY: 25 }

      // Calculate logo dimensions
      try {
        if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
          const logoWidth = 50 // mm
          const img = document.createElement('img')
          await new Promise<void>((resolve) => {
            img.onload = () => {
              const aspectRatio = img.height / img.width
              logoInfo.height = logoWidth * aspectRatio
              logoInfo.x = (pageWidth - logoWidth) / 2
              logoInfo.titleY = 15 + logoInfo.height + 8
              resolve()
            }
            img.onerror = () => resolve()
            img.src = logoDataUrl
          })
        }
      } catch (e) {
        console.error('Failed to calculate logo dimensions:', e)
      }

      // Function to draw background and header on each page
      const drawPageHeader = (pageNum: number) => {
        doc.setFillColor(15, 116, 99) // #0f7463
        doc.rect(0, 0, pageWidth, pageHeight, 'F')

        if (pageNum === 1) {
          // Add logo on first page only
          if (logoInfo.dataUrl && logoInfo.dataUrl.startsWith('data:image')) {
            try {
              doc.addImage(logoInfo.dataUrl, 'PNG', logoInfo.x, 10, logoInfo.width, logoInfo.height)
            } catch (e) {
              console.error('Failed to add logo:', e)
            }
          }

          // Add event title
          doc.setTextColor(255, 255, 255) // White text
          doc.setFontSize(24)
          doc.setFont('helvetica', 'bold')
          const eventTitle = `${selectedEvent.event_name} - Attendance Report`
          const titleWidth = doc.getTextWidth(eventTitle)
          doc.text(eventTitle, (pageWidth - titleWidth) / 2, logoInfo.titleY)

          // Add event details
          doc.setFontSize(12)
          doc.setFont('helvetica', 'normal')
          let currentY = logoInfo.titleY + 10

          const eventDate = new Date(selectedEvent.start_time)
          const startTime = formatTime(selectedEvent.start_time)
          const endTime = formatTime(selectedEvent.end_time)
          const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

          doc.text(`Date: ${dateStr}`, 15, currentY)
          currentY += 6
          doc.text(`Time: ${startTime} - ${endTime}`, 15, currentY)
          currentY += 6
          doc.text(`Event Type: ${selectedEvent.event_type.toUpperCase()}`, 15, currentY)
          currentY += 10
        } else {
          // For subsequent pages, just add background
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(12)
          doc.setFont('helvetica', 'normal')
        }
      }

      // Draw first page header
      drawPageHeader(1)

      // Prepare table data
      const tableData: any[][] = []
      let startY = logoInfo.titleY + 35

      // Fetch fresh allocations for attendance PDF
      const attendAllocRes = await fetch(`/api/events/${selectedEvent.id}/allocations`)
      if (!attendAllocRes.ok) {
        throw new Error('Failed to fetch allocations for attendance PDF')
      }
      const attendAllocJson = await attendAllocRes.json()
      const attendAllocations = (attendAllocJson.allocations || []).map((alloc: any) => {
        let builderData = null
        if (alloc.builders && typeof alloc.builders === 'object') {
          builderData = alloc.builders
        } else if (alloc.builder_id) {
          builderData = builders.find(b => b.id === alloc.builder_id)
        }
        return {
          id: alloc.id,
          builder_id: alloc.builder_id,
          time_slot_start: alloc.time_slot_start,
          time_slot_end: alloc.time_slot_end,
          section: alloc.section || 'desk_1',
          builder: builderData
        }
      }).filter((alloc: any) => alloc.builder_id && (alloc.builder || builders.find(b => b.id === alloc.builder_id)))

      // Generate time slots if needed
      let attendSlotsToUse: TimeSlot[] = timeSlots
      if (attendSlotsToUse.length === 0 && selectedEvent) {
        const startDate = new Date(selectedEvent.start_time)
        const endDate = new Date(selectedEvent.end_time)
        const slotDuration = 30 * 60 * 1000
        const minSlotDuration = 15 * 60 * 1000
        
        attendSlotsToUse = []
        const logisticsStartEnd = new Date(startDate.getTime() + slotDuration)
        attendSlotsToUse.push({
          start: new Date(startDate),
          end: new Date(logisticsStartEnd),
          section: 'logistics_setup'
        })
        
        let currentTime = new Date(logisticsStartEnd)
        let slotIndex = 1
        const logisticsEndStart = new Date(endDate.getTime() - slotDuration)
        
        while (currentTime < logisticsEndStart) {
          const slotEnd = new Date(currentTime.getTime() + slotDuration)
          const actualEnd = slotEnd > logisticsEndStart ? logisticsEndStart : slotEnd
          if (actualEnd > currentTime && (actualEnd.getTime() - currentTime.getTime()) >= minSlotDuration / 2) {
            attendSlotsToUse.push({
              start: new Date(currentTime),
              end: new Date(actualEnd),
              section: `desk_${slotIndex}`
            })
            currentTime = new Date(actualEnd)
            slotIndex++
          } else {
            break
          }
        }
        
        if (currentTime < endDate) {
          attendSlotsToUse.push({
            start: new Date(currentTime),
            end: new Date(endDate),
            section: 'logistics_cleanup'
          })
        }
        
        if (attendSlotsToUse.length === 0 || (endDate.getTime() - startDate.getTime()) < 60 * 60 * 1000) {
          attendSlotsToUse = []
          attendSlotsToUse.push({
            start: new Date(startDate),
            end: new Date(endDate),
            section: 'logistics'
          })
        }
      }

      // Group attendance by slot
      attendSlotsToUse.forEach((slot: TimeSlot, slotIndex: number) => {
        const slotStartTime = new Date(slot.start).getTime()
        const slotAllocations = attendAllocations.filter((a: any) => {
          if (!a.time_slot_start) return false
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            return timeDiff < 1000
          } catch (e) {
            return false
          }
        })

        if (slotAllocations.length === 0) return

        const slotName = getSlotName(slot, slotIndex)
        const slotTime = `${formatTime(slot.start)} - ${formatTime(slot.end)}`

        slotAllocations.forEach((alloc: any, idx: number) => {
          let builder = alloc.builder
          if (!builder && alloc.builder_id) {
            builder = builders.find(b => b.id === alloc.builder_id)
          }
          if (!builder) return

          const attendanceStatus = getAttendanceStatus(builder.id, slot)
          const statusText = attendanceStatus === 'present' ? 'Present' : attendanceStatus === 'absent' ? 'Absent' : 'Not Marked'

          // Check if this is the first member of this slot in the table
          const isFirstInSlot = idx === 0 || (tableData.length > 0 && tableData[tableData.length - 1][0] !== slotName && tableData[tableData.length - 1][0] !== '')

          if (isFirstInSlot) {
            // First row of slot includes slot info
            tableData.push([
              slotName,
              slotTime,
              `${builder.type}${builder.builder_number}`,
              builder.name || 'Unknown',
              builder.department || '—',
              statusText
            ])
          } else {
            // Subsequent rows have empty slot info
            tableData.push([
              '',
              '',
              `${builder.type}${builder.builder_number}`,
              builder.name || 'Unknown',
              builder.department || '—',
              statusText
            ])
          }
        })
      })

      if (tableData.length === 0) {
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.text('No attendance records available.', 15, startY)
        doc.save(`${selectedEvent.event_name}-attendance-${new Date().toISOString().split('T')[0]}.pdf`)
        return
      }

      // Dark green glass look - match admin page styling exactly
      const glassGreen: [number, number, number] = [24, 165, 143] // Same as admin page
      const firstPageTableStartY = startY

      // Add table using autoTable - match admin page format
      autoTable(doc, {
        head: [['Slot', 'Time', 'Builder #', 'Name', 'Department', 'Status']],
        body: tableData,
        startY: firstPageTableStartY,
        theme: 'plain',
        styles: {
          fillColor: glassGreen as any, // Consistent glass green for all cells
          textColor: [255, 255, 255] as any, // White text
          fontSize: 9,
          cellPadding: 4,
          lineColor: [255, 255, 255] as any, // White borders
          lineWidth: 0.3,
          fontStyle: 'normal'
        },
        headStyles: {
          fillColor: [21, 208, 170] as any, // Slightly lighter green for header
          textColor: [255, 255, 255] as any,
          fontStyle: 'bold',
          fontSize: 10,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        bodyStyles: {
          fillColor: glassGreen as any, // Consistent glass green for all body cells
          textColor: [255, 255, 255] as any,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        alternateRowStyles: {
          fillColor: [22, 178, 156] as any // Slightly different shade for alternate rows (still green)
        },
        margin: { top: 15, left: 10, right: 10, bottom: 15 },
        showHead: 'everyPage', // Show header on every page
        showFoot: 'never',
        tableWidth: 'auto',
        didDrawPage: function(data: any) {
          // This callback runs after each page is drawn
          // For pages after the first, we need to ensure background exists
          const pageNum = data.pageNumber
          
          // For pages 2+, draw background using PDF content stream manipulation
          if (pageNum > 1) {
            try {
              const internal = (doc as any).internal
              if (internal && internal.pages && internal.pages[pageNum - 1]) {
                const page = internal.pages[pageNum - 1]
                if (page && Array.isArray(page) && page.length > 2) {
                  const bgR = 15 / 255
                  const bgG = 116 / 255
                  const bgB = 99 / 255
                  const bgColorStr = `${bgR} ${bgG} ${bgB} rg`
                  const bgStream = `q\n${bgColorStr}\n0 0 ${pageWidth} ${pageHeight} re\nf\nQ\n`
                  
                  // Check if background already exists
                  const content = page[2]
                  let hasBg = false
                  if (typeof content === 'string') {
                    hasBg = content.includes(bgColorStr)
                  } else if (Array.isArray(content)) {
                    hasBg = content.some((c: any) => 
                      typeof c === 'string' && c.includes(bgColorStr)
                    )
                  }
                  
                  // Prepend background to content stream if missing
                  if (!hasBg) {
                    if (typeof content === 'string') {
                      page[2] = bgStream + content
                    } else if (Array.isArray(content)) {
                      page[2].unshift(bgStream)
                    } else {
                      page[2] = bgStream
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error adding background in didDrawPage:', e)
            }
          }
        }
      })

      // Calculate per-person time slot summary
      const builderTimeSlots: { [builderId: string]: { builder: Builder, slots: Array<{ slotName: string, time: string, slot: TimeSlot }> } } = {}
      
      attendSlotsToUse.forEach((slot: TimeSlot, slotIndex: number) => {
        const slotStartTime = new Date(slot.start).getTime()
        const slotAllocations = attendAllocations.filter((a: any) => {
          if (!a.time_slot_start) return false
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            return timeDiff < 1000
          } catch (e) {
            return false
          }
        })

        slotAllocations.forEach((alloc: any) => {
          let builder = alloc.builder
          if (!builder && alloc.builder_id) {
            builder = builders.find(b => b.id === alloc.builder_id)
          }
          if (!builder) return

          if (!builderTimeSlots[builder.id]) {
            builderTimeSlots[builder.id] = {
              builder,
              slots: []
            }
          }

          const slotName = getSlotName(slot, slotIndex)
          const slotTime = `${formatTime(slot.start)} - ${formatTime(slot.end)}`
          
          // Check if this slot is already added for this builder
          const existingSlot = builderTimeSlots[builder.id].slots.find(s => 
            s.slotName === slotName && s.time === slotTime
          )
          
          if (!existingSlot) {
            builderTimeSlots[builder.id].slots.push({
              slotName,
              time: slotTime,
              slot
            })
          }
        })
      })

      // Get the final Y position after the table
      const finalY = (doc as any).lastAutoTable?.finalY || startY + (tableData.length * 5) + 20
      let currentY = finalY + 20

      // Add per-person time slot summary section
      if (Object.keys(builderTimeSlots).length > 0) {
        // Check if we need a new page
        if (currentY > pageHeight - 40) {
          doc.addPage()
          const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
          drawPageHeader(pageNum)
          currentY = logoInfo.titleY + 35
        }

        // Add section title
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('Time Slot Assignments by Person', 15, currentY)
        currentY += 10

        // Sort builders by name for consistent ordering
        const sortedBuilders = Object.values(builderTimeSlots).sort((a, b) => {
          const nameA = a.builder.name || ''
          const nameB = b.builder.name || ''
          return nameA.localeCompare(nameB)
        })

        sortedBuilders.forEach((builderInfo, idx) => {
          // Check if we need a new page
          if (currentY > pageHeight - 50) {
            doc.addPage()
            const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
            drawPageHeader(pageNum)
            currentY = logoInfo.titleY + 35
          }

          // Builder name and info
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(255, 255, 255)
          const builderLabel = `${builderInfo.builder.type}${builderInfo.builder.builder_number} - ${builderInfo.builder.name || 'Unknown'}`
          if (builderInfo.builder.department) {
            doc.text(`${builderLabel} (${builderInfo.builder.department})`, 15, currentY)
          } else {
            doc.text(builderLabel, 15, currentY)
          }
          currentY += 7

          // Time slots for this builder
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(230, 255, 250)
          
          if (builderInfo.slots.length === 0) {
            doc.text('  No time slots assigned', 20, currentY)
            currentY += 6
          } else {
            // Sort slots by start time
            const sortedSlots = builderInfo.slots.sort((a, b) => {
              return new Date(a.slot.start).getTime() - new Date(b.slot.start).getTime()
            })

            sortedSlots.forEach((slotInfo) => {
              // Check if we need a new page for this slot
              if (currentY > pageHeight - 30) {
                doc.addPage()
                const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
                drawPageHeader(pageNum)
                currentY = logoInfo.titleY + 35
              }

              doc.text(`  • ${slotInfo.slotName}: ${slotInfo.time}`, 20, currentY)
              currentY += 6
            })
          }

          // Add spacing between builders
          currentY += 4
        })
      }

      // Save PDF
      const fileName = `${selectedEvent.event_name}-attendance-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch (error: any) {
      console.error('Error generating attendance PDF:', error)
      alert(`Failed to generate attendance PDF: ${error.message || 'Unknown error'}`)
    }
  }, [selectedEvent, allocations, builders, timeSlots, getSlotName, formatTime, getAttendanceStatus, fetchAttendanceRecords, loadLogoAsBase64, getAllocatedBuilder])

  // Download PDF with event details and allocations
  const handleDownloadPDF = useCallback(async () => {
    if (!selectedEvent) return

    try {
      // Reload allocations from the API to ensure we have the latest data
      const allocRes = await fetch(`/api/events/${selectedEvent.id}/allocations`)
      if (!allocRes.ok) {
        throw new Error('Failed to fetch allocations')
      }
      const allocJson = await allocRes.json()
      console.log('API response:', allocJson)
      
      // Ensure builders are loaded
      if (builders.length === 0) {
        await fetchBuilders()
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const freshAllocations = (allocJson.allocations || []).map((alloc: any) => {
        // The API returns builders as a nested object
        let builderData = null
        if (alloc.builders && typeof alloc.builders === 'object' && alloc.builders.id) {
          builderData = alloc.builders
        } else if (alloc.builder_id) {
          builderData = builders.find(b => b.id === alloc.builder_id)
        }
        
        // If builder data is still missing, try to find it from builders list
        if (!builderData && alloc.builder_id) {
          builderData = builders.find(b => b.id === alloc.builder_id)
        }
        
        return {
          id: alloc.id,
          builder_id: alloc.builder_id,
          time_slot_start: alloc.time_slot_start,
          time_slot_end: alloc.time_slot_end,
          section: alloc.section || 'desk_1',
          builder: builderData
        }
      })
      
      // Filter out allocations without builder data, but log them for debugging
      const validAllocations = freshAllocations.filter((alloc: any) => {
        const hasBuilder = alloc.builder_id && (alloc.builder || builders.find(b => b.id === alloc.builder_id))
        if (!hasBuilder) {
          console.warn('Allocation without builder:', alloc)
        }
        return hasBuilder
      })
      
      console.log('Total allocations from API:', freshAllocations.length)
      console.log('Valid allocations (with builder):', validAllocations.length)
      if (validAllocations.length > 0) {
        console.log('Sample valid allocation:', {
          id: validAllocations[0].id,
          builder_id: validAllocations[0].builder_id,
          time_slot_start: validAllocations[0].time_slot_start,
          builder: validAllocations[0].builder ? { 
            name: validAllocations[0].builder.name, 
            type: validAllocations[0].builder.type,
            builder_number: validAllocations[0].builder.builder_number
          } : 'MISSING'
        })
      }
      
      // Ensure we have time slots - generate them directly if not available
      let slotsToUse: TimeSlot[] = timeSlots
      if (slotsToUse.length === 0 && selectedEvent) {
        // Generate time slots directly without relying on state
        const startDate = new Date(selectedEvent.start_time)
        const endDate = new Date(selectedEvent.end_time)
        const slotDuration = 30 * 60 * 1000 // 30 minutes in milliseconds
        const minSlotDuration = 15 * 60 * 1000 // 15 minutes minimum
        
        slotsToUse = []
        
        // First slot: Logistics Setup (first 30 minutes)
        const logisticsStartEnd = new Date(startDate.getTime() + slotDuration)
        slotsToUse.push({
          start: new Date(startDate),
          end: new Date(logisticsStartEnd),
          section: 'logistics_setup'
        })
        
        // Generate 30-minute desk slots between logistics
        let currentTime = new Date(logisticsStartEnd)
        let slotIndex = 1
        const logisticsEndStart = new Date(endDate.getTime() - slotDuration) // 30 minutes before end
        
        // Add desk slots until we reach the last 30 minutes
        while (currentTime < logisticsEndStart) {
          const slotEnd = new Date(currentTime.getTime() + slotDuration)
          const actualEnd = slotEnd > logisticsEndStart ? logisticsEndStart : slotEnd
          
          // Only add slot if it has at least some duration
          if (actualEnd > currentTime && (actualEnd.getTime() - currentTime.getTime()) >= minSlotDuration / 2) {
            slotsToUse.push({
              start: new Date(currentTime),
              end: new Date(actualEnd),
              section: `desk_${slotIndex}`
            })
            currentTime = new Date(actualEnd)
            slotIndex++
          } else {
            break
          }
        }
        
        // Last slot: Logistics Cleanup (last 30 minutes)
        if (currentTime < endDate) {
          slotsToUse.push({
            start: new Date(currentTime),
            end: new Date(endDate),
            section: 'logistics_cleanup'
          })
        }
        
        // If event is very short (< 60 minutes), create a single logistics slot
        if (slotsToUse.length === 0 || (endDate.getTime() - startDate.getTime()) < 60 * 60 * 1000) {
          slotsToUse = []
          slotsToUse.push({
            start: new Date(startDate),
            end: new Date(endDate),
            section: 'logistics'
          })
        }
        
        console.log('Generated time slots for PDF:', slotsToUse.length)
      }
      
      console.log('Time slots to use:', slotsToUse.length)
      if (slotsToUse.length > 0) {
        console.log('Sample time slot:', { 
          start: slotsToUse[0].start.toISOString(), 
          end: slotsToUse[0].end.toISOString(),
          section: slotsToUse[0].section,
          startTime: slotsToUse[0].start.getTime()
        })
      }
      console.log('Builders available:', builders.length)
      
      // Load logo
      const logoDataUrl = await loadLogoAsBase64()

      const doc = new jsPDF('portrait', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Store logo data for use in callbacks
      let logoInfo = { dataUrl: logoDataUrl, width: 50, height: 0, x: 0, titleY: 25 }

      // Calculate logo dimensions
      try {
        if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
          const logoWidth = 50 // mm
          const img = document.createElement('img')
          await new Promise<void>((resolve) => {
            img.onload = () => {
              const aspectRatio = img.height / img.width
              logoInfo.height = logoWidth * aspectRatio
              logoInfo.x = (pageWidth - logoWidth) / 2
              logoInfo.titleY = 15 + logoInfo.height + 8
              resolve()
            }
            img.onerror = () => resolve()
            img.src = logoDataUrl
          })
        }
      } catch (e) {
        console.error('Failed to calculate logo dimensions:', e)
      }

      // Draw background and header on first page
      doc.setFillColor(15, 116, 99) // #0f7463
      doc.rect(0, 0, pageWidth, pageHeight, 'F')

      // Add logo on first page
      if (logoInfo.dataUrl && logoInfo.dataUrl.startsWith('data:image')) {
        try {
          doc.addImage(logoInfo.dataUrl, 'PNG', logoInfo.x, 10, logoInfo.width, logoInfo.height)
        } catch (e) {
          console.error('Failed to add logo:', e)
        }
      }

      // Add event title
      doc.setTextColor(255, 255, 255) // White text
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      const eventTitle = selectedEvent.event_name
      const titleWidth = doc.getTextWidth(eventTitle)
      doc.text(eventTitle, (pageWidth - titleWidth) / 2, logoInfo.titleY)

      // Add event details
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      let currentY = logoInfo.titleY + 10

      const eventDate = new Date(selectedEvent.start_time)
      const startTime = formatTime(selectedEvent.start_time)
      const endTime = formatTime(selectedEvent.end_time)
      const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      doc.text(`Date: ${dateStr}`, 15, currentY)
      currentY += 6
      doc.text(`Time: ${startTime} - ${endTime}`, 15, currentY)
      currentY += 6
      doc.text(`Event Type: ${selectedEvent.event_type.toUpperCase()}`, 15, currentY)
      currentY += 10

      // Prepare data for each slot using valid allocations
      const slotData: any[] = []
      
      if (slotsToUse.length === 0) {
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.text('No time slots available for this event.', 15, currentY)
        doc.save(`${selectedEvent.event_name}-${new Date().toISOString().split('T')[0]}.pdf`)
        return
      }
      
      console.log('Processing slots for PDF...')
      console.log('Using valid allocations:', validAllocations.length)
      console.log('Using time slots:', slotsToUse.length)
      
      slotsToUse.forEach((slot, slotIndex) => {
        const slotName = getSlotName(slot, slotIndex)
        const slotTime = `${formatTime(slot.start)} - ${formatTime(slot.end)}`
        
        // Find allocations for this slot using time-based matching
        const slotStartTime = new Date(slot.start).getTime()
        const slotStartISO = slot.start.toISOString()
        
        const slotAllocations = validAllocations.filter((a: any) => {
          if (!a.time_slot_start) {
            console.log('Allocation missing time_slot_start:', a)
            return false
          }
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            const matches = timeDiff < 1000
            
            if (!matches && timeDiff < 60000) {
              // Log near misses for debugging (within 1 minute)
              console.log(`Near miss for slot ${slotIndex}: timeDiff=${timeDiff}ms`, {
                slotTime: slotStartISO,
                allocTime: a.time_slot_start
              })
            }
            
            return matches
          } catch (e) {
            console.error('Error comparing times:', e, a)
            return false
          }
        })
        
        console.log(`Slot ${slotIndex} (${slotName}): ${slotAllocations.length} allocations matched out of ${validAllocations.length} total`)
        
        if (slotAllocations.length > 0) {
          slotAllocations.forEach((alloc: any, idx: number) => {
            // Try multiple ways to get builder data
            let builder = alloc.builder
            if (!builder && alloc.builder_id) {
              builder = builders.find(b => b.id === alloc.builder_id)
            }
            
            if (builder) {
              slotData.push([
                slotName,
                slotTime,
                `${builder.type}${builder.builder_number}`,
                builder.name || 'Unknown',
                builder.department || '—',
                idx === 0 ? slotAllocations.length.toString() : '' // Show count only in first row
              ])
            } else {
              console.error('Builder not found for allocation in PDF:', {
                builder_id: alloc.builder_id,
                allocation_id: alloc.id,
                time_slot_start: alloc.time_slot_start,
                hasBuilder: !!alloc.builder,
                buildersCount: builders.length,
                builderIds: builders.slice(0, 5).map(b => b.id)
              })
            }
          })
        } else {
          console.log(`No allocations found for slot ${slotIndex} (${slotName})`, {
            slotStart: slotStartISO,
            slotStartTime: slotStartTime,
            allAllocationTimes: validAllocations.map((a: any) => ({
              time: a.time_slot_start,
              timeMs: new Date(a.time_slot_start).getTime(),
              diff: Math.abs(new Date(a.time_slot_start).getTime() - slotStartTime)
            }))
          })
        }
      })
      
      console.log('Total rows in PDF:', slotData.length)
      
      if (slotData.length === 0) {
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.text('No members allocated for this event.', 15, currentY)
        currentY += 10
        doc.setFontSize(10)
        doc.text(`Total allocations in database: ${validAllocations.length}`, 15, currentY)
        currentY += 6
        doc.text(`Time slots: ${slotsToUse.length}`, 15, currentY)
        if (validAllocations.length > 0) {
          currentY += 6
          doc.text('Note: Allocations exist but may not match time slots.', 15, currentY)
          currentY += 6
          doc.text('Check browser console for detailed matching information.', 15, currentY)
        }
        doc.save(`${selectedEvent.event_name}-${new Date().toISOString().split('T')[0]}.pdf`)
        return
      }

      // Dark green glass look - match admin page styling exactly
      const glassGreen: [number, number, number] = [24, 165, 143] // Same as admin page
      const firstPageTableStartY = currentY

      // Add table with slot allocations - match admin page format
      autoTable(doc, {
        head: [['Slot', 'Time', 'Builder #', 'Name', 'Department', 'Count']],
        body: slotData,
        startY: firstPageTableStartY,
        theme: 'plain',
        styles: {
          fillColor: glassGreen as any, // Consistent glass green for all cells
          textColor: [255, 255, 255] as any, // White text
          fontSize: 9,
          cellPadding: 4,
          lineColor: [255, 255, 255] as any, // White borders
          lineWidth: 0.3,
          fontStyle: 'normal'
        },
        headStyles: {
          fillColor: [21, 208, 170] as any, // Slightly lighter green for header
          textColor: [255, 255, 255] as any,
          fontStyle: 'bold',
          fontSize: 10,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        bodyStyles: {
          fillColor: glassGreen as any, // Consistent glass green for all body cells
          textColor: [255, 255, 255] as any,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        alternateRowStyles: {
          fillColor: [22, 178, 156] as any // Slightly different shade for alternate rows (still green)
        },
        margin: { top: 15, left: 10, right: 10, bottom: 15 },
        showHead: 'everyPage', // Show header on every page
        showFoot: 'never',
        tableWidth: 'auto',
        didDrawPage: function(data: any) {
          // This callback runs after each page is drawn
          // For pages after the first, we need to ensure background exists
          const pageNum = data.pageNumber
          
          // For pages 2+, draw background using PDF content stream manipulation
          if (pageNum > 1) {
            try {
              const internal = (doc as any).internal
              if (internal && internal.pages && internal.pages[pageNum - 1]) {
                const page = internal.pages[pageNum - 1]
                if (page && Array.isArray(page) && page.length > 2) {
                  const bgR = 15 / 255
                  const bgG = 116 / 255
                  const bgB = 99 / 255
                  const bgColorStr = `${bgR} ${bgG} ${bgB} rg`
                  const bgStream = `q\n${bgColorStr}\n0 0 ${pageWidth} ${pageHeight} re\nf\nQ\n`
                  
                  // Check if background already exists
                  const content = page[2]
                  let hasBg = false
                  if (typeof content === 'string') {
                    hasBg = content.includes(bgColorStr)
                  } else if (Array.isArray(content)) {
                    hasBg = content.some((c: any) => 
                      typeof c === 'string' && c.includes(bgColorStr)
                    )
                  }
                  
                  // Prepend background to content stream if missing
                  if (!hasBg) {
                    if (typeof content === 'string') {
                      page[2] = bgStream + content
                    } else if (Array.isArray(content)) {
                      page[2].unshift(bgStream)
                    } else {
                      page[2] = bgStream
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error adding background in didDrawPage:', e)
            }
          }
        }
      })

      // Calculate per-person time slot summary
      const builderTimeSlots: { [builderId: string]: { builder: Builder, slots: Array<{ slotName: string, time: string, slot: TimeSlot }> } } = {}
      
      slotsToUse.forEach((slot: TimeSlot, slotIndex: number) => {
        const slotStartTime = new Date(slot.start).getTime()
        const slotAllocations = validAllocations.filter((a: any) => {
          if (!a.time_slot_start) return false
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            return timeDiff < 1000
          } catch (e) {
            return false
          }
        })

        slotAllocations.forEach((alloc: any) => {
          let builder = alloc.builder
          if (!builder && alloc.builder_id) {
            builder = builders.find(b => b.id === alloc.builder_id)
          }
          if (!builder) return

          if (!builderTimeSlots[builder.id]) {
            builderTimeSlots[builder.id] = {
              builder,
              slots: []
            }
          }

          const slotName = getSlotName(slot, slotIndex)
          const slotTime = `${formatTime(slot.start)} - ${formatTime(slot.end)}`
          
          // Check if this slot is already added for this builder
          const existingSlot = builderTimeSlots[builder.id].slots.find(s => 
            s.slotName === slotName && s.time === slotTime
          )
          
          if (!existingSlot) {
            builderTimeSlots[builder.id].slots.push({
              slotName,
              time: slotTime,
              slot
            })
          }
        })
      })

      // Function to draw page header (for new pages)
      const drawPageHeader = (pageNum: number) => {
        doc.setFillColor(15, 116, 99) // #0f7463
        doc.rect(0, 0, pageWidth, pageHeight, 'F')

        if (pageNum === 1) {
          // Add logo on first page only
          if (logoInfo.dataUrl && logoInfo.dataUrl.startsWith('data:image')) {
            try {
              doc.addImage(logoInfo.dataUrl, 'PNG', logoInfo.x, 10, logoInfo.width, logoInfo.height)
            } catch (e) {
              console.error('Failed to add logo:', e)
            }
          }

          // Add event title
          doc.setTextColor(255, 255, 255) // White text
          doc.setFontSize(24)
          doc.setFont('helvetica', 'bold')
          const eventTitle = selectedEvent.event_name
          const titleWidth = doc.getTextWidth(eventTitle)
          doc.text(eventTitle, (pageWidth - titleWidth) / 2, logoInfo.titleY)

          // Add event details
          doc.setFontSize(12)
          doc.setFont('helvetica', 'normal')
          let headerY = logoInfo.titleY + 10

          const eventDate = new Date(selectedEvent.start_time)
          const startTime = formatTime(selectedEvent.start_time)
          const endTime = formatTime(selectedEvent.end_time)
          const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

          doc.text(`Date: ${dateStr}`, 15, headerY)
          headerY += 6
          doc.text(`Time: ${startTime} - ${endTime}`, 15, headerY)
          headerY += 6
          doc.text(`Event Type: ${selectedEvent.event_type.toUpperCase()}`, 15, headerY)
        } else {
          // For subsequent pages, just add background
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(12)
          doc.setFont('helvetica', 'normal')
        }
      }

      // Get the final Y position after the table
      const finalY = (doc as any).lastAutoTable?.finalY || firstPageTableStartY + (slotData.length * 5) + 20
      currentY = finalY + 20

      // Add per-person time slot summary section
      if (Object.keys(builderTimeSlots).length > 0) {
        // Check if we need a new page
        if (currentY > pageHeight - 40) {
          doc.addPage()
          const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
          drawPageHeader(pageNum)
          currentY = logoInfo.titleY + 35
        }

        // Add section title
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('Time Slot Assignments by Person', 15, currentY)
        currentY += 10

        // Sort builders by name for consistent ordering
        const sortedBuilders = Object.values(builderTimeSlots).sort((a, b) => {
          const nameA = a.builder.name || ''
          const nameB = b.builder.name || ''
          return nameA.localeCompare(nameB)
        })

        sortedBuilders.forEach((builderInfo, idx) => {
          // Check if we need a new page
          if (currentY > pageHeight - 50) {
            doc.addPage()
            const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
            drawPageHeader(pageNum)
            currentY = logoInfo.titleY + 35
          }

          // Builder name and info
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(255, 255, 255)
          const builderLabel = `${builderInfo.builder.type}${builderInfo.builder.builder_number} - ${builderInfo.builder.name || 'Unknown'}`
          if (builderInfo.builder.department) {
            doc.text(`${builderLabel} (${builderInfo.builder.department})`, 15, currentY)
          } else {
            doc.text(builderLabel, 15, currentY)
          }
          currentY += 7

          // Time slots for this builder
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(230, 255, 250)
          
          if (builderInfo.slots.length === 0) {
            doc.text('  No time slots assigned', 20, currentY)
            currentY += 6
          } else {
            // Sort slots by start time
            const sortedSlots = builderInfo.slots.sort((a, b) => {
              return new Date(a.slot.start).getTime() - new Date(b.slot.start).getTime()
            })

            sortedSlots.forEach((slotInfo) => {
              // Check if we need a new page for this slot
              if (currentY > pageHeight - 30) {
                doc.addPage()
                const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
                drawPageHeader(pageNum)
                currentY = logoInfo.titleY + 35
              }

              doc.text(`  • ${slotInfo.slotName}: ${slotInfo.time}`, 20, currentY)
              currentY += 6
            })
          }

          // Add spacing between builders
          currentY += 4
        })
      }

      // Save PDF
      const fileName = `${selectedEvent.event_name}-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      alert(`Failed to generate PDF: ${error.message || 'Unknown error'}`)
    }
  }, [selectedEvent, builders, timeSlots, getSlotName, formatTime, fetchAllocations, loadLogoAsBase64, generateTimeSlots, fetchBuilders])

  // Download PDF for present members only
  const handleDownloadPresentPDF = useCallback(async () => {
    if (!selectedEvent) return

    try {
      await fetchAttendanceRecords(selectedEvent.id)
      
      // Load logo
      const logoDataUrl = await loadLogoAsBase64()

      const doc = new jsPDF('portrait', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Store logo data for use in callbacks
      let logoInfo = { dataUrl: logoDataUrl, width: 50, height: 0, x: 0, titleY: 25 }

      // Calculate logo dimensions
      try {
        if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
          const logoWidth = 50 // mm
          const img = document.createElement('img')
          await new Promise<void>((resolve) => {
            img.onload = () => {
              const aspectRatio = img.height / img.width
              logoInfo.height = logoWidth * aspectRatio
              logoInfo.x = (pageWidth - logoWidth) / 2
              logoInfo.titleY = 15 + logoInfo.height + 8
              resolve()
            }
            img.onerror = () => resolve()
            img.src = logoDataUrl
          })
        }
      } catch (e) {
        console.error('Failed to calculate logo dimensions:', e)
      }

      // Draw background and header on first page
      doc.setFillColor(15, 116, 99) // #0f7463
      doc.rect(0, 0, pageWidth, pageHeight, 'F')

      // Add logo on first page
      if (logoInfo.dataUrl && logoInfo.dataUrl.startsWith('data:image')) {
        try {
          doc.addImage(logoInfo.dataUrl, 'PNG', logoInfo.x, 10, logoInfo.width, logoInfo.height)
        } catch (e) {
          console.error('Failed to add logo:', e)
        }
      }

      // Add event title
      doc.setTextColor(255, 255, 255) // White text
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      const eventTitle = `${selectedEvent.event_name} - Present Members`
      const titleWidth = doc.getTextWidth(eventTitle)
      doc.text(eventTitle, (pageWidth - titleWidth) / 2, logoInfo.titleY)

      // Add event details
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      let currentY = logoInfo.titleY + 10

      const eventDate = new Date(selectedEvent.start_time)
      const startTime = formatTime(selectedEvent.start_time)
      const endTime = formatTime(selectedEvent.end_time)
      const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      doc.text(`Date: ${dateStr}`, 15, currentY)
      currentY += 6
      doc.text(`Time: ${startTime} - ${endTime}`, 15, currentY)
      currentY += 6
      doc.text(`Event Type: ${selectedEvent.event_type.toUpperCase()}`, 15, currentY)
      currentY += 10

      // Fetch fresh allocations
      const attendAllocRes = await fetch(`/api/events/${selectedEvent.id}/allocations`)
      if (!attendAllocRes.ok) {
        throw new Error('Failed to fetch allocations')
      }
      const attendAllocJson = await attendAllocRes.json()
      const attendAllocations = (attendAllocJson.allocations || []).map((alloc: any) => {
        let builderData = null
        if (alloc.builders && typeof alloc.builders === 'object' && alloc.builders.id) {
          builderData = alloc.builders
        } else if (alloc.builder_id) {
          builderData = builders.find(b => b.id === alloc.builder_id)
        }
        return {
          id: alloc.id,
          builder_id: alloc.builder_id,
          time_slot_start: alloc.time_slot_start,
          time_slot_end: alloc.time_slot_end,
          section: alloc.section || 'desk_1',
          builder: builderData
        }
      }).filter((alloc: any) => alloc.builder_id && (alloc.builder || builders.find(b => b.id === alloc.builder_id)))

      // Generate time slots if needed
      let slotsToUse: TimeSlot[] = timeSlots
      if (slotsToUse.length === 0 && selectedEvent) {
        const startDate = new Date(selectedEvent.start_time)
        const endDate = new Date(selectedEvent.end_time)
        const slotDuration = 30 * 60 * 1000
        const minSlotDuration = 15 * 60 * 1000
        
        slotsToUse = []
        const logisticsStartEnd = new Date(startDate.getTime() + slotDuration)
        slotsToUse.push({
          start: new Date(startDate),
          end: new Date(logisticsStartEnd),
          section: 'logistics_setup'
        })
        
        let currentTime = new Date(logisticsStartEnd)
        let slotIndex = 1
        const logisticsEndStart = new Date(endDate.getTime() - slotDuration)
        
        while (currentTime < logisticsEndStart) {
          const slotEnd = new Date(currentTime.getTime() + slotDuration)
          const actualEnd = slotEnd > logisticsEndStart ? logisticsEndStart : slotEnd
          if (actualEnd > currentTime && (actualEnd.getTime() - currentTime.getTime()) >= minSlotDuration / 2) {
            slotsToUse.push({
              start: new Date(currentTime),
              end: new Date(actualEnd),
              section: `desk_${slotIndex}`
            })
            currentTime = new Date(actualEnd)
            slotIndex++
          } else {
            break
          }
        }
        
        if (currentTime < endDate) {
          slotsToUse.push({
            start: new Date(currentTime),
            end: new Date(endDate),
            section: 'logistics_cleanup'
          })
        }
        
        if (slotsToUse.length === 0 || (endDate.getTime() - startDate.getTime()) < 60 * 60 * 1000) {
          slotsToUse = []
          slotsToUse.push({
            start: new Date(startDate),
            end: new Date(endDate),
            section: 'logistics'
          })
        }
      }

      // Prepare table data - only present members
      const tableData: any[][] = []
      
      slotsToUse.forEach((slot, slotIndex) => {
        const slotStartTime = new Date(slot.start).getTime()
        const slotAllocations = attendAllocations.filter((a: any) => {
          if (!a.time_slot_start) return false
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            return timeDiff < 1000
          } catch (e) {
            return false
          }
        })

        if (slotAllocations.length === 0) return

        const slotName = getSlotName(slot, slotIndex)
        const slotTime = `${formatTime(slot.start)} - ${formatTime(slot.end)}`

        slotAllocations.forEach((alloc: any, idx: number) => {
          let builder = alloc.builder
          if (!builder && alloc.builder_id) {
            builder = builders.find(b => b.id === alloc.builder_id)
          }
          if (!builder) return

          const attendanceStatus = getAttendanceStatus(builder.id, slot)
          if (attendanceStatus !== 'present') return // Only include present members

          if (idx === 0 || tableData.length === 0 || (tableData[tableData.length - 1][0] !== slotName && tableData[tableData.length - 1][0] !== '')) {
            // First row of slot includes slot info
            tableData.push([
              slotName,
              slotTime,
              `${builder.type}${builder.builder_number}`,
              builder.name || 'Unknown',
              builder.department || '—',
              'Present'
            ])
          } else {
            // Subsequent rows have empty slot info
            tableData.push([
              '',
              '',
              `${builder.type}${builder.builder_number}`,
              builder.name || 'Unknown',
              builder.department || '—',
              'Present'
            ])
          }
        })
      })

      if (tableData.length === 0) {
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.text('No present members found.', 15, currentY)
        doc.save(`${selectedEvent.event_name}-present-${new Date().toISOString().split('T')[0]}.pdf`)
        return
      }

      // Dark green glass look - match admin page styling
      const glassGreen: [number, number, number] = [24, 165, 143]
      const firstPageTableStartY = currentY

      // Add table
      autoTable(doc, {
        head: [['Slot', 'Time', 'Builder #', 'Name', 'Department', 'Status']],
        body: tableData,
        startY: firstPageTableStartY,
        theme: 'plain',
        styles: {
          fillColor: glassGreen as any,
          textColor: [255, 255, 255] as any,
          fontSize: 9,
          cellPadding: 4,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3,
          fontStyle: 'normal'
        },
        headStyles: {
          fillColor: [21, 208, 170] as any,
          textColor: [255, 255, 255] as any,
          fontStyle: 'bold',
          fontSize: 10,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        bodyStyles: {
          fillColor: glassGreen as any,
          textColor: [255, 255, 255] as any,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        alternateRowStyles: {
          fillColor: [22, 178, 156] as any
        },
        margin: { top: 15, left: 10, right: 10, bottom: 15 },
        showHead: 'everyPage',
        showFoot: 'never',
        tableWidth: 'auto',
        didDrawPage: function(data: any) {
          const pageNum = data.pageNumber
          if (pageNum > 1) {
            try {
              const internal = (doc as any).internal
              if (internal && internal.pages && internal.pages[pageNum - 1]) {
                const page = internal.pages[pageNum - 1]
                if (page && Array.isArray(page) && page.length > 2) {
                  const bgR = 15 / 255
                  const bgG = 116 / 255
                  const bgB = 99 / 255
                  const bgColorStr = `${bgR} ${bgG} ${bgB} rg`
                  const bgStream = `q\n${bgColorStr}\n0 0 ${pageWidth} ${pageHeight} re\nf\nQ\n`
                  
                  const content = page[2]
                  let hasBg = false
                  if (typeof content === 'string') {
                    hasBg = content.includes(bgColorStr)
                  } else if (Array.isArray(content)) {
                    hasBg = content.some((c: any) => 
                      typeof c === 'string' && c.includes(bgColorStr)
                    )
                  }
                  
                  if (!hasBg) {
                    if (typeof content === 'string') {
                      page[2] = bgStream + content
                    } else if (Array.isArray(content)) {
                      page[2].unshift(bgStream)
                    } else {
                      page[2] = bgStream
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error adding background in didDrawPage:', e)
            }
          }
        }
      })

      // Save PDF
      const fileName = `${selectedEvent.event_name}-present-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch (error: any) {
      console.error('Error generating present PDF:', error)
      alert(`Failed to generate present PDF: ${error.message || 'Unknown error'}`)
    }
  }, [selectedEvent, builders, timeSlots, getSlotName, formatTime, getAttendanceStatus, fetchAttendanceRecords, loadLogoAsBase64])

  // Download PDF for absent members only
  const handleDownloadAbsentPDF = useCallback(async () => {
    if (!selectedEvent) return

    try {
      await fetchAttendanceRecords(selectedEvent.id)
      
      // Load logo
      const logoDataUrl = await loadLogoAsBase64()

      const doc = new jsPDF('portrait', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Store logo data for use in callbacks
      let logoInfo = { dataUrl: logoDataUrl, width: 50, height: 0, x: 0, titleY: 25 }

      // Calculate logo dimensions
      try {
        if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
          const logoWidth = 50 // mm
          const img = document.createElement('img')
          await new Promise<void>((resolve) => {
            img.onload = () => {
              const aspectRatio = img.height / img.width
              logoInfo.height = logoWidth * aspectRatio
              logoInfo.x = (pageWidth - logoWidth) / 2
              logoInfo.titleY = 15 + logoInfo.height + 8
              resolve()
            }
            img.onerror = () => resolve()
            img.src = logoDataUrl
          })
        }
      } catch (e) {
        console.error('Failed to calculate logo dimensions:', e)
      }

      // Draw background and header on first page
      doc.setFillColor(15, 116, 99) // #0f7463
      doc.rect(0, 0, pageWidth, pageHeight, 'F')

      // Add logo on first page
      if (logoInfo.dataUrl && logoInfo.dataUrl.startsWith('data:image')) {
        try {
          doc.addImage(logoInfo.dataUrl, 'PNG', logoInfo.x, 10, logoInfo.width, logoInfo.height)
        } catch (e) {
          console.error('Failed to add logo:', e)
        }
      }

      // Add event title
      doc.setTextColor(255, 255, 255) // White text
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      const eventTitle = `${selectedEvent.event_name} - Absent Members`
      const titleWidth = doc.getTextWidth(eventTitle)
      doc.text(eventTitle, (pageWidth - titleWidth) / 2, logoInfo.titleY)

      // Add event details
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      let currentY = logoInfo.titleY + 10

      const eventDate = new Date(selectedEvent.start_time)
      const startTime = formatTime(selectedEvent.start_time)
      const endTime = formatTime(selectedEvent.end_time)
      const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      doc.text(`Date: ${dateStr}`, 15, currentY)
      currentY += 6
      doc.text(`Time: ${startTime} - ${endTime}`, 15, currentY)
      currentY += 6
      doc.text(`Event Type: ${selectedEvent.event_type.toUpperCase()}`, 15, currentY)
      currentY += 10

      // Fetch fresh allocations
      const attendAllocRes = await fetch(`/api/events/${selectedEvent.id}/allocations`)
      if (!attendAllocRes.ok) {
        throw new Error('Failed to fetch allocations')
      }
      const attendAllocJson = await attendAllocRes.json()
      const attendAllocations = (attendAllocJson.allocations || []).map((alloc: any) => {
        let builderData = null
        if (alloc.builders && typeof alloc.builders === 'object' && alloc.builders.id) {
          builderData = alloc.builders
        } else if (alloc.builder_id) {
          builderData = builders.find(b => b.id === alloc.builder_id)
        }
        return {
          id: alloc.id,
          builder_id: alloc.builder_id,
          time_slot_start: alloc.time_slot_start,
          time_slot_end: alloc.time_slot_end,
          section: alloc.section || 'desk_1',
          builder: builderData
        }
      }).filter((alloc: any) => alloc.builder_id && (alloc.builder || builders.find(b => b.id === alloc.builder_id)))

      // Generate time slots if needed
      let slotsToUse: TimeSlot[] = timeSlots
      if (slotsToUse.length === 0 && selectedEvent) {
        const startDate = new Date(selectedEvent.start_time)
        const endDate = new Date(selectedEvent.end_time)
        const slotDuration = 30 * 60 * 1000
        const minSlotDuration = 15 * 60 * 1000
        
        slotsToUse = []
        const logisticsStartEnd = new Date(startDate.getTime() + slotDuration)
        slotsToUse.push({
          start: new Date(startDate),
          end: new Date(logisticsStartEnd),
          section: 'logistics_setup'
        })
        
        let currentTime = new Date(logisticsStartEnd)
        let slotIndex = 1
        const logisticsEndStart = new Date(endDate.getTime() - slotDuration)
        
        while (currentTime < logisticsEndStart) {
          const slotEnd = new Date(currentTime.getTime() + slotDuration)
          const actualEnd = slotEnd > logisticsEndStart ? logisticsEndStart : slotEnd
          if (actualEnd > currentTime && (actualEnd.getTime() - currentTime.getTime()) >= minSlotDuration / 2) {
            slotsToUse.push({
              start: new Date(currentTime),
              end: new Date(actualEnd),
              section: `desk_${slotIndex}`
            })
            currentTime = new Date(actualEnd)
            slotIndex++
          } else {
            break
          }
        }
        
        if (currentTime < endDate) {
          slotsToUse.push({
            start: new Date(currentTime),
            end: new Date(endDate),
            section: 'logistics_cleanup'
          })
        }
        
        if (slotsToUse.length === 0 || (endDate.getTime() - startDate.getTime()) < 60 * 60 * 1000) {
          slotsToUse = []
          slotsToUse.push({
            start: new Date(startDate),
            end: new Date(endDate),
            section: 'logistics'
          })
        }
      }

      // Prepare table data - only absent members
      const tableData: any[][] = []
      
      slotsToUse.forEach((slot, slotIndex) => {
        const slotStartTime = new Date(slot.start).getTime()
        const slotAllocations = attendAllocations.filter((a: any) => {
          if (!a.time_slot_start) return false
          try {
            const allocStartTime = new Date(a.time_slot_start).getTime()
            const timeDiff = Math.abs(allocStartTime - slotStartTime)
            return timeDiff < 1000
          } catch (e) {
            return false
          }
        })

        if (slotAllocations.length === 0) return

        const slotName = getSlotName(slot, slotIndex)
        const slotTime = `${formatTime(slot.start)} - ${formatTime(slot.end)}`

        slotAllocations.forEach((alloc: any, idx: number) => {
          let builder = alloc.builder
          if (!builder && alloc.builder_id) {
            builder = builders.find(b => b.id === alloc.builder_id)
          }
          if (!builder) return

          const attendanceStatus = getAttendanceStatus(builder.id, slot)
          if (attendanceStatus !== 'absent') return // Only include absent members

          if (idx === 0 || tableData.length === 0 || (tableData[tableData.length - 1][0] !== slotName && tableData[tableData.length - 1][0] !== '')) {
            // First row of slot includes slot info
            tableData.push([
              slotName,
              slotTime,
              `${builder.type}${builder.builder_number}`,
              builder.name || 'Unknown',
              builder.department || '—',
              'Absent'
            ])
          } else {
            // Subsequent rows have empty slot info
            tableData.push([
              '',
              '',
              `${builder.type}${builder.builder_number}`,
              builder.name || 'Unknown',
              builder.department || '—',
              'Absent'
            ])
          }
        })
      })

      if (tableData.length === 0) {
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.text('No absent members found.', 15, currentY)
        doc.save(`${selectedEvent.event_name}-absent-${new Date().toISOString().split('T')[0]}.pdf`)
        return
      }

      // Dark green glass look - match admin page styling
      const glassGreen: [number, number, number] = [24, 165, 143]
      const firstPageTableStartY = currentY

      // Add table
      autoTable(doc, {
        head: [['Slot', 'Time', 'Builder #', 'Name', 'Department', 'Status']],
        body: tableData,
        startY: firstPageTableStartY,
        theme: 'plain',
        styles: {
          fillColor: glassGreen as any,
          textColor: [255, 255, 255] as any,
          fontSize: 9,
          cellPadding: 4,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3,
          fontStyle: 'normal'
        },
        headStyles: {
          fillColor: [21, 208, 170] as any,
          textColor: [255, 255, 255] as any,
          fontStyle: 'bold',
          fontSize: 10,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        bodyStyles: {
          fillColor: glassGreen as any,
          textColor: [255, 255, 255] as any,
          lineColor: [255, 255, 255] as any,
          lineWidth: 0.3
        },
        alternateRowStyles: {
          fillColor: [22, 178, 156] as any
        },
        margin: { top: 15, left: 10, right: 10, bottom: 15 },
        showHead: 'everyPage',
        showFoot: 'never',
        tableWidth: 'auto',
        didDrawPage: function(data: any) {
          const pageNum = data.pageNumber
          if (pageNum > 1) {
            try {
              const internal = (doc as any).internal
              if (internal && internal.pages && internal.pages[pageNum - 1]) {
                const page = internal.pages[pageNum - 1]
                if (page && Array.isArray(page) && page.length > 2) {
                  const bgR = 15 / 255
                  const bgG = 116 / 255
                  const bgB = 99 / 255
                  const bgColorStr = `${bgR} ${bgG} ${bgB} rg`
                  const bgStream = `q\n${bgColorStr}\n0 0 ${pageWidth} ${pageHeight} re\nf\nQ\n`
                  
                  const content = page[2]
                  let hasBg = false
                  if (typeof content === 'string') {
                    hasBg = content.includes(bgColorStr)
                  } else if (Array.isArray(content)) {
                    hasBg = content.some((c: any) => 
                      typeof c === 'string' && c.includes(bgColorStr)
                    )
                  }
                  
                  if (!hasBg) {
                    if (typeof content === 'string') {
                      page[2] = bgStream + content
                    } else if (Array.isArray(content)) {
                      page[2].unshift(bgStream)
                    } else {
                      page[2] = bgStream
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error adding background in didDrawPage:', e)
            }
          }
        }
      })

      // Save PDF
      const fileName = `${selectedEvent.event_name}-absent-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch (error: any) {
      console.error('Error generating absent PDF:', error)
      alert(`Failed to generate absent PDF: ${error.message || 'Unknown error'}`)
    }
  }, [selectedEvent, builders, timeSlots, getSlotName, formatTime, getAttendanceStatus, fetchAttendanceRecords, loadLogoAsBase64])

  const onLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  // Don't render anything until authentication is confirmed
  if (isAuthenticated === null) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f7463',
        gap: '32px',
        padding: '24px'
      }}>
        <Image 
          src={logoImage} 
          alt="BUILDIT Logo" 
          width={200} 
          height={67} 
          style={{ 
            height: 'auto', 
            width: 'auto', 
            maxWidth: '300px',
            objectFit: 'contain' 
          }} 
          priority
        />
        <Loader2 className="animate-spin" size={48} color="white" />
      </div>
    )
  }

  // Only render if authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="vstack" style={{ gap: 18, width: '100%', padding: '24px', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{
        background: 'rgba(21, 208, 170, 0.15)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '12px 20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.2)',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        minWidth: 0
      }}>
        <div className="hstack" style={{ gap: 12, alignItems: 'center', minWidth: 0, flex: '0 1 auto' }}>
          <Image src={logoImage} alt="BUILDIT Logo" width={120} height={40} style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
          <h1 className="brand-title" style={{ margin: 0, fontSize: '22px', whiteSpace: 'nowrap' }}>Attendance Management</h1>
        </div>
        <div className="hstack" style={{ gap: 8, flex: '0 0 auto', flexShrink: 0 }}>
          <Link href="/admin" className="navbar-link" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.1)',
            textDecoration: 'none',
            transition: 'background 0.2s',
            border: '1px solid rgba(255,255,255,0.2)',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>Admin</Link>
          <Link href="/" className="navbar-link" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.1)',
            textDecoration: 'none',
            transition: 'background 0.2s',
            border: '1px solid rgba(255,255,255,0.2)',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>Generator</Link>
          <button onClick={onLogout} className="navbar-button" style={{
            padding: '6px 12px',
            borderRadius: '8px',
            transition: 'background 0.2s',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>Logout</button>
        </div>
      </div>

      {/* Event Type Selection */}
      <div className="hstack" style={{ gap: 12, flexWrap: 'wrap', width: '100%' }}>
        <select
          value={selectedEventType}
          onChange={e => {
            setSelectedEventType(e.target.value as any)
            setSelectedEvent(null)
            setViewMode('create')
            setAllocations([])
            setTimeSlots([])
          }}
          style={{
            flex: '0 1 200px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(21, 208, 170, 0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: 'white',
            padding: '10px 12px',
            cursor: 'pointer'
          }}
        >
          <option value="desk_setup" style={{ background: '#0f7463', color: 'white' }}>Desk Setup</option>
          <option value="night" style={{ background: '#0f7463', color: 'white' }}>Night</option>
          <option value="perm" style={{ background: '#0f7463', color: 'white' }}>Perm</option>
          <option value="gbm" style={{ background: '#0f7463', color: 'white' }}>GBM</option>
        </select>

        {/* Event Selection */}
        {events.length > 0 && (
          <select
            value={selectedEvent?.id || ''}
            onChange={e => {
              const event = events.find(ev => ev.id === e.target.value)
              setSelectedEvent(event || null)
              if (event) {
                setViewMode('allotment')
              }
            }}
            style={{
              flex: '0 1 300px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(21, 208, 170, 0.15)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: 'white',
              padding: '10px 12px',
              cursor: 'pointer'
            }}
          >
            <option value="" style={{ background: '#0f7463', color: 'white' }}>Select Event</option>
            {events.map(event => {
              const eventAllocations = eventAllocationsMap[event.id] || []
              const uniqueMembers = new Set(eventAllocations.map(a => a.builder_id)).size
              return (
                <option key={event.id} value={event.id} style={{ background: '#0f7463', color: 'white' }}>
                  {event.event_name} - {new Date(event.start_time).toLocaleDateString()} ({uniqueMembers} members)
                </option>
              )
            })}
          </select>
        )}

        {selectedEvent && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (viewMode === 'allotment') {
                  setViewMode('allocate')
                } else {
                  setViewMode('allotment')
                }
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: viewMode === 'allotment' ? 'rgba(21, 208, 170, 0.5)' : 'rgba(21, 208, 170, 0.3)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {viewMode === 'allotment' ? 'Edit Allocations' : 'View Allotment'}
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'attendance' ? 'allocate' : 'attendance')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: viewMode === 'attendance' ? 'rgba(21, 208, 170, 0.5)' : 'rgba(21, 208, 170, 0.3)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {viewMode === 'attendance' ? 'Edit Allocations' : 'Mark Attendance'}
            </button>
            <button
              onClick={async () => {
                setViewMode('attendance-view')
                await fetchAttendanceRecords(selectedEvent.id)
                await fetchAllocations(selectedEvent.id)
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: viewMode === 'attendance-view' ? 'rgba(21, 208, 170, 0.5)' : 'rgba(21, 208, 170, 0.3)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              View Attendance Report
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deletingEvent}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.2)',
                color: 'white',
                cursor: deletingEvent ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: deletingEvent ? 0.6 : 1
              }}
            >
              <Trash2 size={16} />
              Delete Event
            </button>
          </div>
        )}
      </div>

      {/* Create Event Form (for desk_setup) */}
      {selectedEventType === 'desk_setup' && viewMode === 'create' && !selectedEvent && (
        <div style={{
          background: 'rgba(21, 208, 170, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.2)',
          width: '100%',
          maxWidth: '600px'
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>Create Desk Setup Event</h2>
          
          <div className="vstack" style={{ gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', opacity: 0.9 }}>Event Name</label>
              <input
                type="text"
                placeholder="e.g., Orientation Desk Setup"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', opacity: 0.9 }}>Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', opacity: 0.9 }}>End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={handleCreateEvent}
              disabled={!eventName || !startTime || !endTime || creatingEvent}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {creatingEvent ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </div>
      )}

      {/* Allotment View - Show allocated members per slot with download option */}
      {selectedEvent && viewMode === 'allotment' && timeSlots.length > 0 && selectedSlotIndex !== null && (
        <div style={{
          background: 'rgba(21, 208, 170, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.2)',
          width: '100%'
        }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Allotment - {selectedEvent.event_name}
            </h2>
            <button
              onClick={handleDownloadPDF}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(21, 208, 170, 0.3)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Download size={16} />
              Download PDF
            </button>
          </div>

          {/* Event Info */}
          <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingEventDate ? '12px' : '0' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#a6fff0' }}>Event Date & Time</h3>
              {!editingEventDate && (
                <button
                  onClick={() => setEditingEventDate(true)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={14} />
                  Edit Date/Time
                </button>
              )}
            </div>
            
            {editingEventDate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#a6fff0' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#a6fff0' }}>
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={(e) => setEventStartTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#a6fff0' }}>
                      End Time
                    </label>
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={(e) => setEventEndTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setEditingEventDate(false)
                      // Reset to original values
                      if (selectedEvent) {
                        const startDate = new Date(selectedEvent.start_time)
                        const endDate = new Date(selectedEvent.end_time)
                        const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
                        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
                        const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
                        setEventDate(dateStr)
                        setEventStartTime(startTimeStr)
                        setEventEndTime(endTimeStr)
                      }
                    }}
                    disabled={updatingEventDate}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      cursor: updatingEventDate ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      opacity: updatingEventDate ? 0.5 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateEventDate}
                    disabled={updatingEventDate}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid rgba(21, 208, 170, 0.5)',
                      background: updatingEventDate ? 'rgba(21, 208, 170, 0.2)' : 'rgba(21, 208, 170, 0.3)',
                      color: 'white',
                      cursor: updatingEventDate ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: updatingEventDate ? 0.7 : 1
                    }}
                  >
                    {updatingEventDate ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
                <div>
                  <strong>Date:</strong> {selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleDateString() : 'N/A'}
                </div>
                <div>
                  <strong>Start:</strong> {selectedEvent.start_time ? formatTime(selectedEvent.start_time) : 'N/A'}
                </div>
                <div>
                  <strong>End:</strong> {selectedEvent.end_time ? formatTime(selectedEvent.end_time) : 'N/A'}
                </div>
              </div>
            )}
          </div>

          {/* Slot Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px', 
            flexWrap: 'wrap',
            borderBottom: '2px solid rgba(255,255,255,0.2)',
            paddingBottom: '12px'
          }}>
            {timeSlots.map((slot, slotIndex) => {
              const slotStartTime = new Date(slot.start).getTime()
              const slotAllocations = allocations.filter(a => {
                if (!a.time_slot_start) return false
                try {
                  const allocStartTime = new Date(a.time_slot_start).getTime()
                  const timeDiff = Math.abs(allocStartTime - slotStartTime)
                  return timeDiff < 1000
                } catch (e) {
                  return false
                }
              })
              const hasAllocations = slotAllocations.length > 0
              
              return (
                <button
                  key={slotIndex}
                  onClick={() => setSelectedSlotIndex(slotIndex)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: selectedSlotIndex === slotIndex 
                      ? 'rgba(21, 208, 170, 0.4)' 
                      : hasAllocations 
                        ? 'rgba(21, 208, 170, 0.2)' 
                        : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: selectedSlotIndex === slotIndex ? '600' : '400',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {getSlotName(slot, slotIndex)}
                  {hasAllocations && (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.3)',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {slotAllocations.length}
                    </span>
                  )}
                  {selectedSlotIndex === slotIndex && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '80%',
                      height: '2px',
                      background: 'rgba(21, 208, 170, 0.8)',
                      borderRadius: '2px'
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Slot Content */}
          {selectedSlotIndex !== null && timeSlots[selectedSlotIndex] && (() => {
            const slot = timeSlots[selectedSlotIndex]
            const slotStartTime = new Date(slot.start).getTime()
            const slotAllocations = allocations.filter(a => {
              if (!a.time_slot_start) return false
              try {
                const allocStartTime = new Date(a.time_slot_start).getTime()
                const timeDiff = Math.abs(allocStartTime - slotStartTime)
                return timeDiff < 1000
              } catch (e) {
                return false
              }
            })
            
            return (
              <div>
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                    {getSlotName(slot, selectedSlotIndex)}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.8 }}>
                    {formatTime(slot.start)} - {formatTime(slot.end)}
                  </div>
                </div>
                
                {slotAllocations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {slotAllocations.map(alloc => {
                      const builder = alloc.builder || builders.find(b => b.id === alloc.builder_id)
                      if (!builder) return null
                      
                      return (
                        <div
                          key={alloc.id || `${alloc.builder_id}_${alloc.time_slot_start}`}
                          style={{
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <span style={{ fontWeight: '500', fontSize: '14px', minWidth: '120px' }}>
                            {builder.name}
                          </span>
                          <span style={{ fontSize: '13px', opacity: 0.8, padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                            {builder.type}{builder.builder_number}
                          </span>
                          {builder.department && (
                            <span style={{ fontSize: '12px', opacity: 0.7, padding: '4px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                              {builder.department}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', opacity: 0.7, fontSize: '14px' }}>
                    No members allocated for this slot.
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Allocation View */}
      {selectedEvent && viewMode === 'allocate' && timeSlots.length > 0 && (
        <div style={{
          background: 'rgba(21, 208, 170, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.2)',
          width: '100%'
        }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Allocate Members - {selectedEvent.event_name}
            </h2>
            <div className="hstack" style={{ gap: '8px' }}>
              <button
                onClick={handleSaveAllocations}
                disabled={savingAllocations}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(21, 208, 170, 0.3)',
                  color: 'white',
                  cursor: savingAllocations ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {savingAllocations ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Saving...
                  </>
                ) : (
                  'Save Allocations'
                )}
              </button>
            </div>
          </div>

          {/* Event Info */}
          <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
              <div>
                <strong>Start:</strong> {selectedEvent.start_time ? formatTime(selectedEvent.start_time) : 'N/A'}
              </div>
              <div>
                <strong>End:</strong> {selectedEvent.end_time ? formatTime(selectedEvent.end_time) : 'N/A'}
              </div>
              <div>
                <strong>Date:</strong> {selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Slot Tab Navigation */}
          {selectedSlotIndex !== null && (
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '20px', 
              flexWrap: 'wrap',
              borderBottom: '2px solid rgba(255,255,255,0.2)',
              paddingBottom: '12px',
              overflowX: 'auto'
            }}>
              {timeSlots.map((slot, slotIndex) => {
                const slotStartTime = new Date(slot.start).getTime()
                const slotAllocations = allocations.filter(a => {
                  if (!a.time_slot_start) return false
                  try {
                    const allocStartTime = new Date(a.time_slot_start).getTime()
                    const timeDiff = Math.abs(allocStartTime - slotStartTime)
                    return timeDiff < 1000
                  } catch (e) {
                    return false
                  }
                })
                const hasAllocations = slotAllocations.length > 0
                const isConfirmed = confirmedSlots.has(slotIndex)
                
                return (
                  <button
                    key={slotIndex}
                    onClick={() => setSelectedSlotIndex(slotIndex)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: selectedSlotIndex === slotIndex 
                        ? 'rgba(21, 208, 170, 0.4)' 
                        : hasAllocations 
                          ? 'rgba(21, 208, 170, 0.2)' 
                          : 'rgba(255,255,255,0.1)',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: selectedSlotIndex === slotIndex ? '600' : '400',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      position: 'relative',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {getSlotName(slot, slotIndex)}
                    {hasAllocations && (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.3)',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {slotAllocations.length}
                      </span>
                    )}
                    {isConfirmed && (
                      <CheckCircle2 size={14} style={{ opacity: 0.8 }} />
                    )}
                    {selectedSlotIndex === slotIndex && (
                      <div style={{
                        position: 'absolute',
                        bottom: '-14px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '80%',
                        height: '2px',
                        background: 'rgba(21, 208, 170, 0.8)',
                        borderRadius: '2px'
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Selected Slot Allocation */}
          {selectedSlotIndex !== null && timeSlots[selectedSlotIndex] && (() => {
            const slot = timeSlots[selectedSlotIndex]
            const slotIndex = selectedSlotIndex
            return (
              <div
                style={{
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  padding: '20px',
                  background: (slot.section === 'logistics' || slot.section === 'logistics_setup' || slot.section === 'logistics_cleanup') 
                    ? 'rgba(21, 208, 170, 0.2)' 
                    : 'rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                      {slot.section === 'logistics_setup' ? '📦 Logistics (Setup)' : 
                       slot.section === 'logistics_cleanup' ? '📦 Logistics (Cleanup)' : 
                       slot.section === 'logistics' ? '📦 Logistics' : 
                       `🪑 Desk Slot ${slotIndex}`}
                    </h3>
                    {confirmedSlots.has(slotIndex) && (
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        background: 'rgba(21, 208, 170, 0.3)', 
                        border: '1px solid rgba(21, 208, 170, 0.5)',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#18c5a6'
                      }}>
                        ✓ Confirmed
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    {formatTime(slot.start)} - {formatTime(slot.end)}
                  </div>
                </div>

                {/* Allocated Members Display - Show if has allocations or is confirmed */}
                {(getAllocatedBuilder(slot).length > 0 || confirmedSlots.has(slotIndex)) && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(21, 208, 170, 0.1)', borderRadius: '8px', border: '1px solid rgba(21, 208, 170, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', opacity: 0.9 }}>
                        Allocated Members ({getAllocatedBuilder(slot).length}):
                      </div>
                      {!confirmedSlots.has(slotIndex) && (
                        <button
                          onClick={() => {
                            // Only allow confirming if there are allocations, or show warning
                            if (getAllocatedBuilder(slot).length === 0) {
                              if (!confirm('This slot has no allocated members. Confirm anyway?')) {
                                return
                              }
                            }
                            setConfirmedSlots(prev => {
                              const newSet = new Set(prev)
                              newSet.add(slotIndex)
                              return newSet
                            })
                            setEditingSlots(prev => {
                              const newSet = new Set(prev)
                              newSet.delete(slotIndex)
                              return newSet
                            })
                            // Clear department selection when confirming
                            setSelectedDepartmentsBySlot(prev => {
                              const newState = { ...prev }
                              delete newState[slotIndex]
                              return newState
                            })
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid rgba(21, 208, 170, 0.5)',
                            background: getAllocatedBuilder(slot).length > 0 
                              ? 'rgba(21, 208, 170, 0.3)' 
                              : 'rgba(255,255,255,0.1)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: getAllocatedBuilder(slot).length === 0 ? 0.7 : 1
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Confirm
                        </button>
                      )}
                      {confirmedSlots.has(slotIndex) && (
                        <>
                          {editingSlots.has(slotIndex) && (
                            <button
                              onClick={() => {
                                // Save changes: confirm the slot and exit edit mode
                                setConfirmedSlots(prev => {
                                  const newSet = new Set(prev)
                                  newSet.add(slotIndex)
                                  return newSet
                                })
                                setEditingSlots(prev => {
                                  const newSet = new Set(prev)
                                  newSet.delete(slotIndex)
                                  return newSet
                                })
                                // Clear department selection when saving
                                setSelectedDepartmentsBySlot(prev => {
                                  const newState = { ...prev }
                                  delete newState[slotIndex]
                                  return newState
                                })
                              }}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid rgba(21, 208, 170, 0.5)',
                                background: 'rgba(21, 208, 170, 0.3)',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <CheckCircle2 size={14} />
                              Save Edit
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingSlots(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(slotIndex)) {
                                  newSet.delete(slotIndex)
                                } else {
                                  newSet.add(slotIndex)
                                }
                                return newSet
                              })
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.3)',
                              background: editingSlots.has(slotIndex) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}
                          >
                            {editingSlots.has(slotIndex) ? 'Cancel Edit' : 'Edit'}
                          </button>
                        </>
                      )}
                    </div>
                    {getAllocatedBuilder(slot).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {getAllocatedBuilder(slot).map(builder => (
                          <div
                            key={builder.id}
                            style={{
                              padding: '6px 12px',
                              background: confirmedSlots.has(slotIndex) && !editingSlots.has(slotIndex) 
                                ? 'rgba(21, 208, 170, 0.4)' 
                                : 'rgba(21, 208, 170, 0.3)',
                              borderRadius: '6px',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              border: '1px solid rgba(21, 208, 170, 0.5)',
                              opacity: confirmedSlots.has(slotIndex) && !editingSlots.has(slotIndex) ? 0.9 : 1
                            }}
                          >
                            <span style={{ fontWeight: '600' }}>{builder.type}{builder.builder_number}</span>
                            <span style={{ opacity: 0.9 }}>{builder.name}</span>
                            {builder.department && (
                              <span style={{ opacity: 0.7, fontSize: '11px', fontStyle: 'italic' }}>{builder.department}</span>
                            )}
                            {(!confirmedSlots.has(slotIndex) || editingSlots.has(slotIndex)) && (
                              <button
                                onClick={() => handleAllocate(builder.id, slot)}
                                style={{
                                  background: 'rgba(255,0,0,0.3)',
                                  border: '1px solid rgba(255,0,0,0.5)',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  color: 'white',
                                  marginLeft: '4px',
                                  fontWeight: '600'
                                }}
                                title="Remove allocation"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : confirmedSlots.has(slotIndex) && !editingSlots.has(slotIndex) ? (
                      <div style={{ 
                        padding: '12px', 
                        textAlign: 'center', 
                        opacity: 0.7, 
                        fontSize: '13px',
                        fontStyle: 'italic'
                      }}>
                        No members allocated. Click "Edit" to add members.
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Department Selection - Only show if not confirmed or in edit mode */}
                {(!confirmedSlots.has(slotIndex) || editingSlots.has(slotIndex)) && (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#a6fff0' }}>
                        Select Department:
                      </label>
                      <select
                        value={selectedDepartmentsBySlot[slotIndex] || ''}
                        onChange={(e) => {
                          setSelectedDepartmentsBySlot({
                            ...selectedDepartmentsBySlot,
                            [slotIndex]: e.target.value
                          })
                        }}
                        style={{
                          width: '100%',
                          maxWidth: '400px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(255,255,255,0.1)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: 'white',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        <option value="" style={{ background: '#0f7463', color: 'white' }}>Select a department...</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept} style={{ background: '#0f7463', color: 'white' }}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Department Members (shown when department is selected for this slot) */}
                    {selectedDepartmentsBySlot[slotIndex] && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '16px', 
                    background: 'rgba(255,255,255,0.05)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#a6fff0' }}>
                        {selectedDepartmentsBySlot[slotIndex]} Members
                      </div>
                      <button
                        onClick={() => handleSelectAllDepartment(selectedDepartmentsBySlot[slotIndex], slot)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(21, 208, 170, 0.5)',
                          background: (() => {
                            const dept = selectedDepartmentsBySlot[slotIndex]
                            const deptBuilders = getDepartmentBuilders(dept)
                            const slotStart = slot.start.toISOString()
                            const allocatedBuilders = allocations
                              .filter(a => a.time_slot_start === slotStart)
                              .map(a => a.builder_id)
                            const allAllocated = deptBuilders.length > 0 && deptBuilders.every(b => allocatedBuilders.includes(b.id))
                            return allAllocated ? 'rgba(21, 208, 170, 0.4)' : 'rgba(21, 208, 170, 0.2)'
                          })(),
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          transition: 'all 0.2s'
                        }}
                      >
                        {(() => {
                          const dept = selectedDepartmentsBySlot[slotIndex]
                          const deptBuilders = getDepartmentBuilders(dept)
                          const slotStart = slot.start.toISOString()
                          const allocatedBuilders = allocations
                            .filter(a => a.time_slot_start === slotStart)
                            .map(a => a.builder_id)
                          const allAllocated = deptBuilders.length > 0 && deptBuilders.every(b => allocatedBuilders.includes(b.id))
                          return allAllocated ? 'Deselect All' : 'Select All'
                        })()}
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {getDepartmentBuilders(selectedDepartmentsBySlot[slotIndex]).map(builder => {
                        const allocated = isAllocated(builder.id, slot)
                        return (
                          <button
                            key={builder.id}
                            onClick={() => handleAllocate(builder.id, slot)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '6px',
                              border: allocated ? '2px solid #18c5a6' : '1px solid rgba(255,255,255,0.2)',
                              background: allocated ? 'rgba(21, 208, 170, 0.4)' : 'rgba(255,255,255,0.08)',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.2s',
                              fontWeight: allocated ? '600' : '400'
                            }}
                          >
                            {allocated && <CheckCircle2 size={16} color="#18c5a6" />}
                            <span style={{ fontWeight: '600' }}>{builder.type}{builder.builder_number}</span>
                            <span style={{ opacity: 0.9 }}>{builder.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Attendance Marking View */}
      {selectedEvent && viewMode === 'attendance' && timeSlots.length > 0 && selectedSlotIndex !== null && (
        <div style={{
          background: 'rgba(21, 208, 170, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.2)',
          width: '100%'
        }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Mark Attendance - {selectedEvent.event_name}
            </h2>
            <button
              onClick={handleSaveAttendance}
              disabled={savingAttendance}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(21, 208, 170, 0.3)',
                color: 'white',
                cursor: savingAttendance ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {savingAttendance ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Saving...
                </>
              ) : (
                'Save Attendance'
              )}
            </button>
            <button
              onClick={handleDownloadAttendancePDF}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(21, 208, 170, 0.3)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Download size={16} />
              Download Attendance PDF
            </button>
          </div>

          {/* Event Info */}
          <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
              <div>
                <strong>Start:</strong> {selectedEvent.start_time ? formatTime(selectedEvent.start_time) : 'N/A'}
              </div>
              <div>
                <strong>End:</strong> {selectedEvent.end_time ? formatTime(selectedEvent.end_time) : 'N/A'}
              </div>
              <div>
                <strong>Date:</strong> {selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Slot Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px', 
            flexWrap: 'wrap',
            borderBottom: '2px solid rgba(255,255,255,0.2)',
            paddingBottom: '12px',
            overflowX: 'auto'
          }}>
            {timeSlots.map((slot, slotIndex) => {
              const slotStartTime = new Date(slot.start).getTime()
              const slotAllocations = allocations.filter(a => {
                if (!a.time_slot_start) return false
                try {
                  const allocStartTime = new Date(a.time_slot_start).getTime()
                  const timeDiff = Math.abs(allocStartTime - slotStartTime)
                  return timeDiff < 1000
                } catch (e) {
                  return false
                }
              })
              const hasAllocations = slotAllocations.length > 0
              
              return (
                <button
                  key={slotIndex}
                  onClick={() => setSelectedSlotIndex(slotIndex)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: selectedSlotIndex === slotIndex 
                      ? 'rgba(21, 208, 170, 0.4)' 
                      : hasAllocations 
                        ? 'rgba(21, 208, 170, 0.2)' 
                        : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: selectedSlotIndex === slotIndex ? '600' : '400',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    position: 'relative',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {getSlotName(slot, slotIndex)}
                  {hasAllocations && (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.3)',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {slotAllocations.length}
                    </span>
                  )}
                  {selectedSlotIndex === slotIndex && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '80%',
                      height: '2px',
                      background: 'rgba(21, 208, 170, 0.8)',
                      borderRadius: '2px'
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Slot Attendance */}
          {selectedSlotIndex !== null && timeSlots[selectedSlotIndex] && (() => {
            const slot = timeSlots[selectedSlotIndex]
            const slotStartTime = new Date(slot.start).getTime()
            const slotAllocations = allocations.filter(a => {
              if (!a.time_slot_start) return false
              try {
                const allocStartTime = new Date(a.time_slot_start).getTime()
                const timeDiff = Math.abs(allocStartTime - slotStartTime)
                return timeDiff < 1000
              } catch (e) {
                return false
              }
            })

            if (slotAllocations.length === 0) {
              return (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.7, fontSize: '14px' }}>
                  No members allocated for this slot. Please allocate members first.
                </div>
              )
            }

            return (
              <div>
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                    {getSlotName(slot, selectedSlotIndex)}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.8 }}>
                    {formatTime(slot.start)} - {formatTime(slot.end)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {slotAllocations.map(alloc => {
                    const builder = alloc.builder || builders.find(b => b.id === alloc.builder_id)
                    if (!builder) return null

                    const attendanceStatus = getAttendanceStatus(builder.id, slot)

                    return (
                      <div
                        key={alloc.id || alloc.builder_id}
                        style={{
                          padding: '12px 16px',
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                          <span style={{ fontWeight: '600', fontSize: '14px', minWidth: '120px' }}>
                            {builder.name}
                          </span>
                          <span style={{ fontSize: '13px', opacity: 0.8, padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                            {builder.type}{builder.builder_number}
                          </span>
                          {builder.department && (
                            <span style={{ fontSize: '12px', opacity: 0.7, padding: '4px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                              {builder.department}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleMarkAttendance(builder.id, slot, 'present')}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.2)',
                              background: attendanceStatus === 'present' 
                                ? 'rgba(34, 197, 94, 0.4)' 
                                : 'rgba(255,255,255,0.1)',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: '500',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'background 0.2s'
                            }}
                          >
                            <CheckCircle2 size={16} />
                            Present
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(builder.id, slot, 'absent')}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.2)',
                              background: attendanceStatus === 'absent' 
                                ? 'rgba(239, 68, 68, 0.4)' 
                                : 'rgba(255,255,255,0.1)',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: '500',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'background 0.2s'
                            }}
                          >
                            <XCircle size={16} />
                            Absent
                          </button>
                          {attendanceStatus && (
                            <span style={{ 
                              fontSize: '12px', 
                              opacity: 0.8, 
                              padding: '4px 8px', 
                              background: attendanceStatus === 'present' 
                                ? 'rgba(34, 197, 94, 0.2)' 
                                : 'rgba(239, 68, 68, 0.2)',
                              borderRadius: '4px'
                            }}>
                              {attendanceStatus === 'present' ? '✓ Marked Present' : '✗ Marked Absent'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Attendance View - Show present/absent separately with slot timings */}
      {selectedEvent && viewMode === 'attendance-view' && (
        <div style={{
          background: 'rgba(21, 208, 170, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.2)',
          width: '100%'
        }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Attendance Report - {selectedEvent.event_name}
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleDownloadAttendancePDF}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(21, 208, 170, 0.3)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Download All
              </button>
              <button
                onClick={handleDownloadPresentPDF}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                  background: 'rgba(34, 197, 94, 0.3)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Download Present
              </button>
              <button
                onClick={handleDownloadAbsentPDF}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  background: 'rgba(239, 68, 68, 0.3)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Download Absent
              </button>
            </div>
          </div>

          {/* Event Info */}
          <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
              <div>
                <strong>Start:</strong> {selectedEvent.start_time ? formatTime(selectedEvent.start_time) : 'N/A'}
              </div>
              <div>
                <strong>End:</strong> {selectedEvent.end_time ? formatTime(selectedEvent.end_time) : 'N/A'}
              </div>
              <div>
                <strong>Date:</strong> {selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px', 
            borderBottom: '2px solid rgba(255,255,255,0.2)',
            paddingBottom: '12px'
          }}>
            <button
              onClick={() => setAttendanceViewFilter('all')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: attendanceViewFilter === 'all' ? 'rgba(21, 208, 170, 0.4)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: attendanceViewFilter === 'all' ? '600' : '400',
                fontSize: '14px'
              }}
            >
              All
            </button>
            <button
              onClick={() => setAttendanceViewFilter('present')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                background: attendanceViewFilter === 'present' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.2)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: attendanceViewFilter === 'present' ? '600' : '400',
                fontSize: '14px'
              }}
            >
              Present
            </button>
            <button
              onClick={() => setAttendanceViewFilter('absent')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: attendanceViewFilter === 'absent' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: attendanceViewFilter === 'absent' ? '600' : '400',
                fontSize: '14px'
              }}
            >
              Absent
            </button>
          </div>

          {/* Attendance List by Slot */}
          {(() => {
            // Use current timeSlots or generate if empty
            let displaySlots: TimeSlot[] = timeSlots
            if (displaySlots.length === 0 && selectedEvent) {
              const startDate = new Date(selectedEvent.start_time)
              const endDate = new Date(selectedEvent.end_time)
              const slotDuration = 30 * 60 * 1000
              const minSlotDuration = 15 * 60 * 1000
              
              displaySlots = []
              const logisticsStartEnd = new Date(startDate.getTime() + slotDuration)
              displaySlots.push({
                start: new Date(startDate),
                end: new Date(logisticsStartEnd),
                section: 'logistics_setup'
              })
              
              let currentTime = new Date(logisticsStartEnd)
              let slotIndex = 1
              const logisticsEndStart = new Date(endDate.getTime() - slotDuration)
              
              while (currentTime < logisticsEndStart) {
                const slotEnd = new Date(currentTime.getTime() + slotDuration)
                const actualEnd = slotEnd > logisticsEndStart ? logisticsEndStart : slotEnd
                if (actualEnd > currentTime && (actualEnd.getTime() - currentTime.getTime()) >= minSlotDuration / 2) {
                  displaySlots.push({
                    start: new Date(currentTime),
                    end: new Date(actualEnd),
                    section: `desk_${slotIndex}`
                  })
                  currentTime = new Date(actualEnd)
                  slotIndex++
                } else {
                  break
                }
              }
              
              if (currentTime < endDate) {
                displaySlots.push({
                  start: new Date(currentTime),
                  end: new Date(endDate),
                  section: 'logistics_cleanup'
                })
              }
              
              if (displaySlots.length === 0 || (endDate.getTime() - startDate.getTime()) < 60 * 60 * 1000) {
                displaySlots = []
                displaySlots.push({
                  start: new Date(startDate),
                  end: new Date(endDate),
                  section: 'logistics'
                })
              }
            }
            
            if (displaySlots.length === 0) {
              return (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.7, fontSize: '14px' }}>
                  No time slots available for this event.
                </div>
              )
            }

            // Use current allocations for display
            const displayAllocations = allocations

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {displaySlots.map((slot: TimeSlot, slotIndex: number) => {
                  const slotStartTime = new Date(slot.start).getTime()
                  const slotAllocations = displayAllocations.filter((a: Allocation) => {
                    if (!a.time_slot_start) return false
                    try {
                      const allocStartTime = new Date(a.time_slot_start).getTime()
                      const timeDiff = Math.abs(allocStartTime - slotStartTime)
                      return timeDiff < 1000
                    } catch (e) {
                      return false
                    }
                  })

                  if (slotAllocations.length === 0) return null

                  // Separate present and absent
                  const presentMembers: Array<{ alloc: Allocation, builder: Builder, status: 'present' | 'absent' | null }> = []
                  const absentMembers: Array<{ alloc: Allocation, builder: Builder, status: 'present' | 'absent' | null }> = []
                  const notMarkedMembers: Array<{ alloc: Allocation, builder: Builder, status: 'present' | 'absent' | null }> = []

                  slotAllocations.forEach(alloc => {
                    const builder = alloc.builder || builders.find(b => b.id === alloc.builder_id)
                    if (!builder) return
                    const status = getAttendanceStatus(builder.id, slot)
                    const member = { alloc, builder, status }
                    if (status === 'present') {
                      presentMembers.push(member)
                    } else if (status === 'absent') {
                      absentMembers.push(member)
                    } else {
                      notMarkedMembers.push(member)
                    }
                  })

                  // Filter based on view filter
                  let membersToShow: typeof presentMembers = []
                  if (attendanceViewFilter === 'present') {
                    membersToShow = presentMembers
                  } else if (attendanceViewFilter === 'absent') {
                    membersToShow = absentMembers
                  } else {
                    membersToShow = [...presentMembers, ...absentMembers, ...notMarkedMembers]
                  }

                  if (membersToShow.length === 0 && attendanceViewFilter !== 'all') return null

                  return (
                    <div
                      key={slotIndex}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                          {getSlotName(slot, slotIndex)}
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.8 }}>
                          {formatTime(slot.start)} - {formatTime(slot.end)}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
                          Present: {presentMembers.length} | Absent: {absentMembers.length} | Not Marked: {notMarkedMembers.length}
                        </div>
                      </div>

                      {/* Present Members */}
                      {attendanceViewFilter === 'all' && presentMembers.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#22c55e', marginBottom: '8px' }}>
                            Present ({presentMembers.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {presentMembers.map(({ alloc, builder }) => (
                              <div
                                key={alloc.id || alloc.builder_id}
                                style={{
                                  padding: '10px 12px',
                                  background: 'rgba(34, 197, 94, 0.15)',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{builder.name}</span>
                                  <span style={{ fontSize: '13px', opacity: 0.8, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {builder.type}{builder.builder_number}
                                  </span>
                                  {builder.department && (
                                    <span style={{ fontSize: '12px', opacity: 0.7, padding: '4px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                                      {builder.department}
                                    </span>
                                  )}
                                </div>
                                <span style={{ 
                                  fontSize: '12px', 
                                  fontWeight: '600',
                                  color: '#22c55e',
                                  padding: '4px 8px',
                                  background: 'rgba(34, 197, 94, 0.2)',
                                  borderRadius: '4px'
                                }}>
                                  ✓ Present
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Absent Members */}
                      {attendanceViewFilter === 'all' && absentMembers.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444', marginBottom: '8px' }}>
                            Absent ({absentMembers.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {absentMembers.map(({ alloc, builder }) => (
                              <div
                                key={alloc.id || alloc.builder_id}
                                style={{
                                  padding: '10px 12px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{builder.name}</span>
                                  <span style={{ fontSize: '13px', opacity: 0.8, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {builder.type}{builder.builder_number}
                                  </span>
                                  {builder.department && (
                                    <span style={{ fontSize: '12px', opacity: 0.7, padding: '4px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                                      {builder.department}
                                    </span>
                                  )}
                                </div>
                                <span style={{ 
                                  fontSize: '12px', 
                                  fontWeight: '600',
                                  color: '#ef4444',
                                  padding: '4px 8px',
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  borderRadius: '4px'
                                }}>
                                  ✗ Absent
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Not Marked Members (only show in 'all' view) */}
                      {attendanceViewFilter === 'all' && notMarkedMembers.length > 0 && (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
                            Not Marked ({notMarkedMembers.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {notMarkedMembers.map(({ alloc, builder }) => (
                              <div
                                key={alloc.id || alloc.builder_id}
                                style={{
                                  padding: '10px 12px',
                                  background: 'rgba(255,255,255,0.05)',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{builder.name}</span>
                                  <span style={{ fontSize: '13px', opacity: 0.8, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {builder.type}{builder.builder_number}
                                  </span>
                                  {builder.department && (
                                    <span style={{ fontSize: '12px', opacity: 0.7, padding: '4px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                                      {builder.department}
                                    </span>
                                  )}
                                </div>
                                <span style={{ 
                                  fontSize: '12px', 
                                  opacity: 0.6,
                                  padding: '4px 8px',
                                  background: 'rgba(255,255,255,0.05)',
                                  borderRadius: '4px'
                                }}>
                                  Not Marked
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filtered View - Show only present or absent */}
                      {attendanceViewFilter === 'present' && presentMembers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {presentMembers.map(({ alloc, builder }) => (
                            <div
                              key={alloc.id || alloc.builder_id}
                              style={{
                                padding: '10px 12px',
                                background: 'rgba(34, 197, 94, 0.15)',
                                borderRadius: '8px',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '600', fontSize: '14px' }}>{builder.name}</span>
                                <span style={{ fontSize: '13px', opacity: 0.8, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                  {builder.type}{builder.builder_number}
                                </span>
                                {builder.department && (
                                  <span style={{ fontSize: '12px', opacity: 0.7, padding: '4px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                                    {builder.department}
                                  </span>
                                )}
                              </div>
                              <span style={{ 
                                fontSize: '12px', 
                                fontWeight: '600',
                                color: '#22c55e',
                                padding: '4px 8px',
                                background: 'rgba(34, 197, 94, 0.2)',
                                borderRadius: '4px'
                              }}>
                                ✓ Present
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {attendanceViewFilter === 'absent' && absentMembers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {absentMembers.map(({ alloc, builder }) => (
                            <div
                              key={alloc.id || alloc.builder_id}
                              style={{
                                padding: '10px 12px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                borderRadius: '8px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '600', fontSize: '14px' }}>{builder.name}</span>
                                <span style={{ fontSize: '13px', opacity: 0.8, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                  {builder.type}{builder.builder_number}
                                </span>
                                {builder.department && (
                                  <span style={{ fontSize: '12px', opacity: 0.7, padding: '4px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                                    {builder.department}
                                  </span>
                                )}
                              </div>
                              <span style={{ 
                                fontSize: '12px', 
                                fontWeight: '600',
                                color: '#ef4444',
                                padding: '4px 8px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                borderRadius: '4px'
                              }}>
                                ✗ Absent
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {showDeleteConfirm && selectedEvent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(21, 208, 170, 0.95)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.3)',
              maxWidth: '500px',
              width: '100%'
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: 'white' }}>
              Delete Event
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', opacity: 0.9, color: 'white', lineHeight: '1.6' }}>
              Are you sure you want to delete the event <strong>"{selectedEvent.event_name}"</strong>?
              <br />
              <span style={{ fontSize: '13px', opacity: 0.8 }}>
                This will also delete all associated allocations and attendance records. This action cannot be undone.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingEvent}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: deletingEvent ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={deletingEvent}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  background: deletingEvent ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.6)',
                  color: 'white',
                  cursor: deletingEvent ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {deletingEvent ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .navbar-link:hover {
          background: rgba(255,255,255,0.2) !important;
        }
        .navbar-button:hover {
          background: rgba(255,255,255,0.15) !important;
        }
        @media print {
          .navbar-link, .navbar-button, button:not(.print-button) {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}

