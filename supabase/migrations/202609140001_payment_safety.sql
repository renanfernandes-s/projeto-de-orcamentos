create table if not exists public.payment_attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    payment_id text unique,
    idempotency_key text not null,
    method text not null check (method in ('PIX', 'CREDIT_CARD')),
    cpf_cnpj text not null,
    invoice_url text,
    status text not null default 'PROCESSING',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, idempotency_key)
);

create index if not exists payment_attempts_user_id_idx on public.payment_attempts(user_id);
alter table public.payment_attempts enable row level security;

create or replace function public.consumir_pdf_gratuito(p_user_id uuid)
returns table (allowed boolean, pdf_count integer)
language plpgsql security definer set search_path = public
as $$
begin
    return query
    update public.profiles
       set pdf_count = profiles.pdf_count + 1
     where profiles.id = p_user_id
       and profiles.is_pro = false
       and profiles.pdf_count < 3
    returning true, profiles.pdf_count;
end;
$$;

revoke all on function public.consumir_pdf_gratuito(uuid) from public;
grant execute on function public.consumir_pdf_gratuito(uuid) to service_role;