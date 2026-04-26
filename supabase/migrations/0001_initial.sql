-- ============================================================
-- mi-despensa-familiar | migration 0001 | 2026-04-25
-- Initial schema: households, members, products, consumption logs, RLS
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

create table public.households (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id  uuid  not null references public.households(id) on delete cascade,
  user_id       uuid  not null references auth.users(id) on delete cascade,
  role          text  not null check (role in ('owner', 'member')),
  created_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.products (
  id             uuid        primary key default gen_random_uuid(),
  household_id   uuid        not null references public.households(id) on delete cascade,
  name           text        not null,
  brand          text,
  category       text        not null check (category in ('despensa','higiene','bebe','limpieza','frescos','farmacia')),
  unit           text,
  current_stock  numeric     not null default 0 check (current_stock >= 0),
  min_stock      numeric     not null default 0 check (min_stock >= 0),
  price          numeric     not null default 0 check (price >= 0),
  barcode        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.consumption_logs (
  id          uuid        primary key default gen_random_uuid(),
  product_id  uuid        not null references public.products(id) on delete cascade,
  qty         numeric     not null,
  date        timestamptz not null default now(),
  type        text        check (type is null or type = 'restock'),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_household_members_user_id
  on public.household_members(user_id);

create index idx_products_household_category
  on public.products(household_id, category);

create index idx_consumption_logs_product_date
  on public.consumption_logs(product_id, date desc);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================

create or replace function public.is_household_member(h_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = h_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(h_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = h_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.products          enable row level security;
alter table public.consumption_logs  enable row level security;

-- households policies
create policy households_select_member
  on public.households for select
  using (public.is_household_member(id));

create policy households_insert_authenticated
  on public.households for insert
  with check (auth.uid() is not null);

create policy households_update_owner
  on public.households for update
  using (public.is_household_owner(id));

create policy households_delete_owner
  on public.households for delete
  using (public.is_household_owner(id));

-- household_members policies
create policy household_members_select_member
  on public.household_members for select
  using (public.is_household_member(household_id));

-- Bootstrap: allows inserting the first member (owner) of a new household without recursion.
-- The alias `hm` in the subquery is critical — it prevents the policy from referencing
-- the row being inserted via the table name, which would cause infinite recursion.
create policy household_members_insert_owner_or_bootstrap
  on public.household_members for insert
  with check (
    public.is_household_owner(household_id)
    or not exists (
      select 1
      from public.household_members hm
      where hm.household_id = household_members.household_id
    )
  );

create policy household_members_delete_owner
  on public.household_members for delete
  using (public.is_household_owner(household_id));

-- products policies
create policy products_select_member
  on public.products for select
  using (public.is_household_member(household_id));

create policy products_insert_member
  on public.products for insert
  with check (public.is_household_member(household_id));

create policy products_update_member
  on public.products for update
  using (public.is_household_member(household_id));

create policy products_delete_member
  on public.products for delete
  using (public.is_household_member(household_id));

-- consumption_logs policies
create policy consumption_logs_select_member
  on public.consumption_logs for select
  using (
    exists (
      select 1 from public.products p
      where p.id = consumption_logs.product_id
        and public.is_household_member(p.household_id)
    )
  );

create policy consumption_logs_insert_member
  on public.consumption_logs for insert
  with check (
    exists (
      select 1 from public.products p
      where p.id = consumption_logs.product_id
        and public.is_household_member(p.household_id)
    )
  );

create policy consumption_logs_update_member
  on public.consumption_logs for update
  using (
    exists (
      select 1 from public.products p
      where p.id = consumption_logs.product_id
        and public.is_household_member(p.household_id)
    )
  );

create policy consumption_logs_delete_member
  on public.consumption_logs for delete
  using (
    exists (
      select 1 from public.products p
      where p.id = consumption_logs.product_id
        and public.is_household_member(p.household_id)
    )
  );

-- ============================================================
-- GRANTS (Data API auto-expose is OFF — explicit grants required)
-- ============================================================

grant usage on schema public to authenticated;
grant all on public.households, public.household_members, public.products, public.consumption_logs to authenticated;
