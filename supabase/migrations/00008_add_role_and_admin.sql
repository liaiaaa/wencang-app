-- ============================================================
-- 00008: 用户角色与管理员预约管理
--
-- 用途：云端（真实 Supabase）模式下启用管理员视角。
--   1. 新增 public.profiles 表，保存用户角色
--   2. 新用户注册时自动建档（默认 role = 'user'）
--   3. 管理员可查看并更新全部预约
--
-- 执行后请把管理员的 role 置为 'admin'，见文件末尾。
-- 演示（mock）模式无需本迁移，管理员角色按内置邮箱判定。
-- ============================================================

-- ---------- 1. 角色表 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 用户可读取自己的档案；管理员可读取全部
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- ---------- 2. 管理员判定函数 ----------
-- security definer：避免 RLS 递归（profiles 策略中调用本函数）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- 3. 注册时自动建档 ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 为已存在的用户补档
insert into public.profiles (id, role)
select id, 'user' from auth.users
on conflict (id) do nothing;

-- ---------- 4. 预约：管理员可查看与更新全部 ----------
drop policy if exists "bookings_select_admin" on public.bookings;
create policy "bookings_select_admin" on public.bookings
  for select to authenticated
  using (public.is_admin());

drop policy if exists "bookings_update_admin" on public.bookings;
create policy "bookings_update_admin" on public.bookings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 5. 指定管理员
--
-- 演示模式下管理员账号为 admin / wencang2026（对应邮箱 admin@miaoda.com），
-- 云端模式下请先把该账号注册到 auth.users，再执行：
--
--   update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'admin@miaoda.com');
--
-- 或按邮箱直接指定任意管理员：
--
--   update public.profiles p
--   set role = 'admin'
--   from auth.users u
--   where p.id = u.id and u.email = 'admin@miaoda.com';
-- ============================================================
