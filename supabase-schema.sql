-- Run ALL of these in Supabase SQL Editor

-- 1. Add new columns to reports table
alter table reports add column if not exists priority text default 'רגיל';
alter table reports add column if not exists assigned_unit text;
alter table reports add column if not exists status text default 'חדש';

-- 2. Create comments table
create table if not exists report_comments (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references reports(id) on delete cascade,
  content text not null,
  created_by text default 'מפעיל',
  created_at timestamptz default now()
);
alter table report_comments enable row level security;
create policy "Allow all comments" on report_comments for all using (true);
grant all on report_comments to anon;
grant all on report_comments to authenticated;

-- 3. Create event log table (shift diary)
create table if not exists event_log (
  id uuid primary key default uuid_generate_v4(),
  entry_type text default 'manual',
  content text not null,
  created_by text default 'מפעיל',
  related_report_id uuid references reports(id) on delete set null,
  created_at timestamptz default now()
);
alter table event_log enable row level security;
create policy "Allow all logs" on event_log for all using (true);
grant all on event_log to anon;
grant all on event_log to authenticated;

-- 4. Enable realtime on new tables
alter publication supabase_realtime add table report_comments;
alter publication supabase_realtime add table event_log;
