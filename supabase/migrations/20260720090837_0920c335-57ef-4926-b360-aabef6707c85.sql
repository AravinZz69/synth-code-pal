
create extension if not exists vector;

-- repositories
create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner text not null,
  name text not null,
  default_branch text,
  status text not null default 'pending',
  status_message text,
  tech_stack jsonb default '{}'::jsonb,
  mermaid text,
  file_tree jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.repositories to authenticated;
grant all on public.repositories to service_role;
alter table public.repositories enable row level security;
create policy "own repositories" on public.repositories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index repositories_user_idx on public.repositories(user_id, created_at desc);

-- code_chunks with 3072-dim gemini embeddings
create table public.code_chunks (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  path text not null,
  start_line int,
  end_line int,
  kind text,
  content text not null,
  embedding vector(3072) not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.code_chunks to authenticated;
grant all on public.code_chunks to service_role;
alter table public.code_chunks enable row level security;
create policy "own chunks" on public.code_chunks
  for all to authenticated
  using (exists (select 1 from public.repositories r where r.id = code_chunks.repository_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.repositories r where r.id = code_chunks.repository_id and r.user_id = auth.uid()));
create index code_chunks_repo_idx on public.code_chunks(repository_id);
create index code_chunks_embedding_idx on public.code_chunks
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- github_tokens
create table public.github_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.github_tokens to authenticated;
grant all on public.github_tokens to service_role;
alter table public.github_tokens enable row level security;
create policy "own token" on public.github_tokens
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- similarity search RPC (RLS applies on code_chunks)
create or replace function public.match_chunks(
  p_repository_id uuid,
  query_embedding vector(3072),
  match_count int default 8
)
returns table (
  id uuid,
  path text,
  start_line int,
  end_line int,
  kind text,
  content text,
  similarity float
)
language sql stable
security invoker
set search_path = public
as $$
  select
    c.id, c.path, c.start_line, c.end_line, c.kind, c.content,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.code_chunks c
  where c.repository_id = p_repository_id
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;
grant execute on function public.match_chunks(uuid, vector, int) to authenticated;
