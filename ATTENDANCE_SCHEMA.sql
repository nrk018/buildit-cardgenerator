-- Events table for tracking different event types
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_type text not null, -- 'desk_setup', 'night', 'perm', 'gbm'
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  created_by text,
  status text default 'draft', -- 'draft', 'scheduled', 'in_progress', 'completed'
  notes text
);

-- Event allocations table for assigning members to time slots
create table if not exists public.event_allocations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  builder_id uuid not null references public.builders(id) on delete cascade,
  time_slot_start timestamp with time zone not null,
  time_slot_end timestamp with time zone not null,
  section text, -- 'logistics', 'desk_1', 'desk_2', etc.
  allocated_at timestamp with time zone not null default now(),
  allocated_by text,
  constraint event_allocations_unique unique (event_id, builder_id, time_slot_start)
);

-- Attendance records table for marking present/absent
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  builder_id uuid not null references public.builders(id) on delete cascade,
  time_slot_start timestamp with time zone not null,
  status text not null, -- 'present', 'absent'
  marked_at timestamp with time zone not null default now(),
  marked_by text,
  notes text,
  constraint attendance_records_unique unique (event_id, builder_id, time_slot_start)
);

-- Indexes for better query performance
create index if not exists events_type_idx on public.events(event_type);
create index if not exists events_status_idx on public.events(status);
create index if not exists event_allocations_event_id_idx on public.event_allocations(event_id);
create index if not exists event_allocations_builder_id_idx on public.event_allocations(builder_id);
create index if not exists event_allocations_time_slot_idx on public.event_allocations(time_slot_start, time_slot_end);
create index if not exists attendance_records_event_id_idx on public.attendance_records(event_id);
create index if not exists attendance_records_builder_id_idx on public.attendance_records(builder_id);
create index if not exists attendance_records_time_slot_idx on public.attendance_records(time_slot_start);

