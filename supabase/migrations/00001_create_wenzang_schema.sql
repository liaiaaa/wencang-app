-- ============ 纹样表 ============
create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('蜡染','扎染','苗绣')),
  region text not null default '',
  technique text not null default '',
  meaning text not null default '',
  image_url text not null,
  created_at timestamptz not null default now()
);

-- ============ 守艺人表 ============
create table public.artisans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null default '',
  craft text not null default '',
  works text not null default '',
  bio text not null default '',
  image_url text not null,
  created_at timestamptz not null default now()
);

-- ============ 体验项目表 ============
create table public.experience_projects (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid references public.artisans(id) on delete set null,
  name text not null,
  description text not null default '',
  duration text not null default '',
  created_at timestamptz not null default now()
);

-- ============ 预约表 ============
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artisan_id uuid references public.artisans(id) on delete set null,
  project_id uuid references public.experience_projects(id) on delete set null,
  artisan_name text not null default '',
  project_name text not null default '',
  book_date date not null,
  time_slot text not null,
  contact_name text not null,
  contact_phone text not null,
  status text not null default '待确认' check (status in ('待确认','已确认','已完成')),
  created_at timestamptz not null default now()
);

-- ============ 文创商品表 ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  craft_description text not null default '',
  artisan_id uuid references public.artisans(id) on delete set null,
  artisan_name text not null default '',
  image_url text not null,
  created_at timestamptz not null default now()
);

-- ============ 订单表 ============
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  order_number text unique not null,
  price numeric(10,2) not null default 0,
  contact_name text not null,
  contact_phone text not null,
  address text not null default '',
  status text not null default '待发货' check (status in ('待发货','已发货','已完成')),
  created_at timestamptz not null default now()
);

-- 订单号自动生成触发器
create or replace function public.gen_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'WZ' || to_char(now(), 'YYYYMMDD') || lpad((floor(random()*100000))::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger trg_gen_order_number
before insert on public.orders
for each row execute function public.gen_order_number();

-- ============ AI生成纹样表 ============
create table public.ai_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  theme text not null,
  category text not null default '苗绣',
  image_url text not null,
  name text not null default '',
  meaning text not null default '',
  created_at timestamptz not null default now()
);

-- ============ 启用 RLS ============
alter table public.patterns enable row level security;
alter table public.artisans enable row level security;
alter table public.experience_projects enable row level security;
alter table public.bookings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.ai_patterns enable row level security;

-- patterns: 公开只读
create policy "patterns_select_all" on public.patterns for select to anon, authenticated using (true);

-- artisans: 公开只读
create policy "artisans_select_all" on public.artisans for select to anon, authenticated using (true);

-- experience_projects: 公开只读
create policy "exp_select_all" on public.experience_projects for select to anon, authenticated using (true);

-- bookings: 用户管理自己的预约
create policy "bookings_select_own" on public.bookings for select to authenticated using (user_id = auth.uid());
create policy "bookings_insert_own" on public.bookings for insert to authenticated with check (user_id = auth.uid());
create policy "bookings_update_own" on public.bookings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- products: 公开只读
create policy "products_select_all" on public.products for select to anon, authenticated using (true);

-- orders: 用户管理自己的订单
create policy "orders_select_own" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "orders_insert_own" on public.orders for insert to authenticated with check (user_id = auth.uid());

-- ai_patterns: 用户管理自己的AI纹样
create policy "ai_select_own" on public.ai_patterns for select to authenticated using (user_id = auth.uid());
create policy "ai_insert_own" on public.ai_patterns for insert to authenticated with check (user_id = auth.uid());
create policy "ai_delete_own" on public.ai_patterns for delete to authenticated using (user_id = auth.uid());