-- Migration: round_ready table for "ready for next round" signaling
create table if not exists round_ready (
  id uuid primary key default gen_random_uuid(),
  week_id uuid references weeks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(week_id, user_id)
);

alter table round_ready enable row level security;

create policy "Anyone can read round_ready"
  on round_ready for select using (true);

create policy "Users can insert own ready"
  on round_ready for insert with check (auth.uid() = user_id);

create policy "Users can delete own ready"
  on round_ready for delete using (auth.uid() = user_id);
