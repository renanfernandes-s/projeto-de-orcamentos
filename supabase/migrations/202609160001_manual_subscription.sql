alter table public.profiles
  add column if not exists plan_status text not null default 'inactive',
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_expires_at timestamptz,
  add column if not exists last_payment_id text;

update public.profiles
set plan_status = 'active',
    plan_started_at = coalesce(plan_started_at, now()),
    plan_expires_at = coalesce(plan_expires_at, now() + interval '30 days')
where is_pro = true
  and plan_expires_at is null;

create or replace function public.conceder_periodo_pro(
    p_user_id uuid,
    p_payment_id text
)
returns table (plan_started_at timestamptz, plan_expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
    if exists (
        select 1
        from public.profiles
        where profiles.id = p_user_id
          and profiles.last_payment_id = p_payment_id
    ) then
        return query
        select profiles.plan_started_at, profiles.plan_expires_at
        from public.profiles
        where profiles.id = p_user_id;
        return;
    end if;

    return query
    update public.profiles
       set is_pro = true,
           plan_status = 'active',
           plan_started_at = case
               when profiles.plan_expires_at is not null and profiles.plan_expires_at > now()
                   then coalesce(profiles.plan_started_at, now())
               else now()
           end,
           plan_expires_at = case
               when profiles.plan_expires_at is not null and profiles.plan_expires_at > now()
                   then profiles.plan_expires_at + interval '30 days'
               else now() + interval '30 days'
           end,
           last_payment_id = p_payment_id
         where profiles.id = p_user_id
             and profiles.last_payment_id is distinct from p_payment_id
    returning profiles.plan_started_at, profiles.plan_expires_at;

        if not found then
                return query
                select profiles.plan_started_at, profiles.plan_expires_at
                from public.profiles
                where profiles.id = p_user_id
                    and profiles.last_payment_id = p_payment_id;
        end if;
end;
$$;

revoke all on function public.conceder_periodo_pro(uuid, text) from public;
grant execute on function public.conceder_periodo_pro(uuid, text) to service_role;

create or replace function public.consumir_pdf_gratuito(p_user_id uuid)
returns table (allowed boolean, pdf_count integer)
language plpgsql security definer set search_path = public
as $$
begin
    return query
    update public.profiles
       set pdf_count = profiles.pdf_count + 1
     where profiles.id = p_user_id
       and not (
           profiles.plan_status = 'active'
           and profiles.plan_expires_at is not null
           and profiles.plan_expires_at > now()
       )
       and profiles.pdf_count < 3
    returning true, profiles.pdf_count;
end;
$$;

revoke all on function public.consumir_pdf_gratuito(uuid) from public;
grant execute on function public.consumir_pdf_gratuito(uuid) to service_role;