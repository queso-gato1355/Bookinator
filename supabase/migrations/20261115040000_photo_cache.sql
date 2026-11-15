-- Shared cache for the book-image Edge Function: one Unsplash search per phrase for every visitor, instead of
-- one per browser (the Unsplash demo key allows 50 requests an hour). Stores only the hotlink URL and credits
-- Unsplash returned (images stay on Unsplash, as its guidelines require). Written and read by the function with
-- the service role; no client access (RLS on, no policies).
create table if not exists public.photo_cache (
  query text primary key check (length(query) between 2 and 80),
  image jsonb,                       -- null = Unsplash had no result for this phrase
  fetched_at timestamptz not null default now()
);
alter table public.photo_cache enable row level security;
