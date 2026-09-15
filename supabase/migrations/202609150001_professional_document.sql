alter table public.profiles
  add column if not exists documento text,
  add column if not exists documento_salvo boolean not null default false;

create or replace function public.ensure_profile_document_columns()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'documento'
  ) then
    alter table public.profiles add column documento text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'documento_salvo'
  ) then
    alter table public.profiles add column documento_salvo boolean not null default false;
  end if;
end;
$$;

select public.ensure_profile_document_columns();

drop function if exists public.ensure_profile_document_columns();
