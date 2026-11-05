  -- Einmal im Supabase-Dashboard unter "SQL Editor" ausfuehren.
  create table if not exists rooms (
    code text primary key check (code ~ '^[A-Z0-9]{5}$'),
    seed integer not null,
    era integer,
    iq boolean not null default false,
    created_by text check (char_length(created_by) <= 20),
    created_at timestamptz not null default now()
  );
  
  create table if not exists scores (
    id bigint generated always as identity primary key,
    room text not null references rooms(code),
    player_id text not null check (char_length(player_id) between 8 and 64),
    name text not null check (char_length(name) between 1 and 20),
    wins integer not null check (wins between 0 and 82),
    losses integer not null check (losses between 0 and 82),
    po integer not null check (po between 0 and 5),
    score integer not null,
    strength integer,
    chem text check (char_length(chem) <= 40),
    lineup jsonb,
    created_at timestamptz not null default now(),
    unique (room, player_id)
  );
  
  alter table rooms enable row level security;
  alter table scores enable row level security;
  
  -- Jeder darf lesen und neue Eintraege anlegen, aber nichts aendern oder loeschen.
  create policy "rooms read" on rooms for select using (true);
  create policy "rooms insert" on rooms for insert with check (true);
  create policy "scores read" on scores for select using (true);
  create policy "scores insert" on scores for insert with check (true);
