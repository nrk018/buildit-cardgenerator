# Attendance System - Desk Setup

This document describes the attendance system for managing desk setup events.

## Database Schema

Run the SQL in `ATTENDANCE_SCHEMA.sql` to create the required tables:

1. **events** - Stores event information (name, type, start/end time, status)
2. **event_allocations** - Stores member assignments to time slots
3. **attendance_records** - Stores attendance marks (present/absent) for each time slot

## Features

### Desk Setup Event

1. **Create Event**: 
   - Select event type (desk_setup, night, perm, gbm)
   - Enter event name, start time, and end time
   - Time slots are automatically generated in 30-minute intervals

2. **Time Slots**:
   - First slot: Logistics (first 30 minutes)
   - Subsequent slots: Desk slots (30-minute intervals)
   - Each slot shows start and end time

3. **Member Allocation**:
   - EC and CC members are shown separately
   - Click on a member to allocate them to a time slot
   - Click again to remove allocation
   - Allocated members are displayed at the top of each slot
   - Save allocations to persist to database

4. **Print**: 
   - Print button generates a printable view of allocations
   - Hides navigation buttons and other UI elements

## API Routes

### Events
- `GET /api/events` - Get all events (optionally filtered by type)
- `POST /api/events` - Create a new event
- `GET /api/events/[id]` - Get a specific event
- `PATCH /api/events/[id]` - Update an event
- `DELETE /api/events/[id]` - Delete an event

### Allocations
- `GET /api/events/[id]/allocations` - Get all allocations for an event
- `POST /api/events/[id]/allocations` - Create/update allocations for an event

### Attendance
- `GET /api/events/[id]/attendance` - Get attendance records for an event
- `POST /api/events/[id]/attendance` - Mark attendance for a single member/slot
- `PATCH /api/events/[id]/attendance` - Batch mark attendance

## Usage

1. Navigate to `/attendance`
2. Select "Desk Setup" as event type
3. Click "Create Event" and fill in details
4. Allocate members to time slots by clicking on member names
5. Click "Save Allocations" to persist
6. Use "Print" button to generate a printable view
7. During the event, switch to "Mark Attendance" mode to record presence

## Next Steps

- Implement attendance marking UI (present/absent)
- Add other event types (night, perm, gbm)
- Add export functionality (CSV, PDF)
- Add attendance statistics and reports

