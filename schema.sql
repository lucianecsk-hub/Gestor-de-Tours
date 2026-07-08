-- Rode este script inteiro no Supabase: SQL Editor -> New query -> cole tudo -> Run

create extension if not exists "pgcrypto";

-- ========== Tabela de lançamentos (um registro por dia/tour) ==========
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table entries enable row level security;

create policy "Usuarios veem apenas seus proprios lancamentos"
  on entries for select
  using (auth.uid() = user_id);

create policy "Usuarios inserem apenas seus proprios lancamentos"
  on entries for insert
  with check (auth.uid() = user_id);

create policy "Usuarios atualizam apenas seus proprios lancamentos"
  on entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuarios excluem apenas seus proprios lancamentos"
  on entries for delete
  using (auth.uid() = user_id);

-- ========== Tabela de configuracoes (uma linha por usuario) ==========
create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;

create policy "Usuarios veem apenas suas proprias configuracoes"
  on settings for select
  using (auth.uid() = user_id);

create policy "Usuarios inserem apenas suas proprias configuracoes"
  on settings for insert
  with check (auth.uid() = user_id);

create policy "Usuarios atualizam apenas suas proprias configuracoes"
  on settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
