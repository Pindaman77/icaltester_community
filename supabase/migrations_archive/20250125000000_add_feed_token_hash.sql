-- Add feed_token_hash to calendars and ensure secure token generation.

create extension if not exists pgcrypto with schema extensions;

alter table public.calendars
  add column if not exists feed_token_hash text;

create or replace function public.generate_feed_token()
returns text
language sql
volatile
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

alter table public.calendars
  alter column feed_token set default public.generate_feed_token();

create or replace function public.set_feed_token_hash()
returns trigger
language plpgsql
as $$
begin
  if new.feed_token is null then
    new.feed_token := public.generate_feed_token();
  end if;

  new.feed_token_hash := encode(extensions.digest(new.feed_token, 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists trg_set_feed_token_hash on public.calendars;
create trigger trg_set_feed_token_hash
before insert or update of feed_token on public.calendars
for each row execute function public.set_feed_token_hash();

update public.calendars
set feed_token_hash = encode(extensions.digest(feed_token, 'sha256'), 'hex')
where feed_token_hash is null and feed_token is not null;

alter table public.calendars
  alter column feed_token_hash set not null;

create unique index if not exists calendars_feed_token_hash_idx
on public.calendars(feed_token_hash);
