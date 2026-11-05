-- Teil 2: Lobby, bis zu 4 Spieler pro Raum, Conference-Playoffs, Tages-Bestenliste.
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausfuehren (setup.sql muss vorher gelaufen sein).

-- Raeume: Host und Start-Freigabe
alter table rooms add column if not exists host_id text;
alter table rooms add column if not exists started boolean not null default false;

-- Sammelraum fuer die Daily-Challenge
insert into rooms (code, seed) values ('DAILY', 0) on conflict do nothing;

-- Ergebnisse: pro Tag auswertbar; in Freunde-Raeumen zaehlt weiter nur der erste Versuch, in DAILY einer pro Tag
alter table scores add column if not exists day date not null default ((now() at time zone 'utc')::date);
alter table scores drop constraint if exists scores_room_player_id_key;
create unique index if not exists scores_room_player_once on scores (room, player_id) where room <> 'DAILY';
create unique index if not exists scores_daily_once on scores (room, player_id, day) where room = 'DAILY';

-- Mitspieler pro Raum (max. 4, nur solange der Host noch nicht gestartet hat)
create table if not exists room_players (
  room text not null references rooms(code),
  player_id text not null check (char_length(player_id) between 8 and 64),
  name text not null check (char_length(name) between 1 and 20),
  joined_at timestamptz not null default now(),
  primary key (room, player_id)
);
alter table room_players enable row level security;
drop policy if exists "rp read" on room_players;
drop policy if exists "rp insert" on room_players;
create policy "rp read" on room_players for select using (true);
create policy "rp insert" on room_players for insert with check (
  (select count(*) from room_players rp where rp.room = room_players.room) < 4
  and not exists (select 1 from rooms r where r.code = room_players.room and r.started)
);

-- Der Host darf den Raum starten (nur diese Spalte ist aenderbar)
revoke update on rooms from anon, authenticated;
grant update (started) on rooms to anon, authenticated;
drop policy if exists "rooms start" on rooms;
create policy "rooms start" on rooms for update using (true) with check (true);

-- Playoff-Eintraege: pro Spieler und Runde die Teamstaerke (Runde -1 = Siege der Saison)
create table if not exists po_entries (
  room text not null references rooms(code),
  player_id text not null check (char_length(player_id) between 8 and 64),
  round integer not null check (round between -1 and 3),
  strength numeric not null,
  skip boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (room, player_id, round)
);
alter table po_entries enable row level security;
drop policy if exists "pe read" on po_entries;
drop policy if exists "pe insert" on po_entries;
drop policy if exists "pe skip" on po_entries;
create policy "pe read" on po_entries for select using (true);
create policy "pe insert" on po_entries for insert with check (true);
revoke update on po_entries from anon, authenticated;
grant update (skip) on po_entries to anon, authenticated;
create policy "pe skip" on po_entries for update using (true) with check (true);
