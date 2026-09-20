-- S12: bulk setup.
--
-- A batch records what an upload did, so an applied import can be undone and a
-- dry run can be told apart from a real one afterwards. The rows are kept with
-- their original values, because the error file the owner downloads is the file
-- he uploaded plus two columns — fixing a spreadsheet he already has beats
-- transcribing messages off a screen.

create type public.import_status as enum ('validating','validated','applied','failed','cancelled','reversed');

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_code text not null,
  file_name text,
  status public.import_status not null default 'validating',
  dry_run boolean not null default true,
  row_count integer not null default 0,
  error_count integer not null default 0,
  created_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (org_id,id)
);
create index import_batches_list on public.import_batches(org_id,created_at desc,id desc);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  batch_id uuid not null,
  row_number integer not null,
  raw jsonb not null,
  status text not null,
  error_field text,
  error_message text,
  created_record_id uuid,
  created_at timestamptz not null default now(),
  unique (org_id,id),
  foreign key (org_id,batch_id) references public.import_batches(org_id,id) on delete cascade
);
create index import_rows_batch on public.import_rows(org_id,batch_id,row_number,id);

alter table public.import_batches enable row level security;
alter table public.import_batches force row level security;
alter table public.import_rows enable row level security;
alter table public.import_rows force row level security;
revoke all on public.import_batches from anon,authenticated;
revoke all on public.import_rows from anon,authenticated;
grant select, insert on public.import_batches to authenticated;
grant select, insert on public.import_rows to authenticated;
grant update on public.import_batches to authenticated;

create policy import_batches_select on public.import_batches
  for select to authenticated using (public.my_role(org_id) in ('owner','manager'));
create policy import_batches_insert on public.import_batches
  for insert to authenticated
  with check (public.my_role(org_id) in ('owner','manager') and created_by = auth.uid());
create policy import_batches_update on public.import_batches
  for update to authenticated
  using (public.my_role(org_id) in ('owner','manager'))
  with check (public.my_role(org_id) in ('owner','manager'));
create policy import_rows_select on public.import_rows
  for select to authenticated using (public.my_role(org_id) in ('owner','manager'));
create policy import_rows_insert on public.import_rows
  for insert to authenticated with check (public.my_role(org_id) in ('owner','manager'));
