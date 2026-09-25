create table if not exists public.feedbacks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    rating smallint not null check (rating between 1 and 5),
    comment text check (comment is null or char_length(comment) <= 2000),
    source text not null check (source in ('first_free_pdf')),
    google_redirected boolean not null default false,
    email_status text not null default 'not_requested'
        check (email_status in ('not_requested', 'sent', 'pending_configuration', 'failed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source)
);

alter table public.feedbacks enable row level security;

revoke all on table public.feedbacks from anon, authenticated;
grant select, insert on table public.feedbacks to authenticated;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'feedbacks'
          and policyname = 'feedbacks_select_own'
    ) then
        create policy feedbacks_select_own
            on public.feedbacks for select
            to authenticated
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'feedbacks'
          and policyname = 'feedbacks_insert_own'
    ) then
        create policy feedbacks_insert_own
            on public.feedbacks for insert
            to authenticated
            with check (auth.uid() = user_id);
    end if;
end;
$$;