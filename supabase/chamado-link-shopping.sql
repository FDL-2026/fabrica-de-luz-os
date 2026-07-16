-- ============================================================
-- LINK DE CHAMADO INDIVIDUAL POR SHOPPING
-- Rode no SQL Editor do Supabase.
--
-- Cada projeto ganha um token próprio (chamado_token). O valor é
-- gerado por PADRÃO na coluna, então todo projeto novo criado ao
-- importar o cronograma já nasce com o token — sem alterar a função
-- de importação. O link público fica: /chamado/<token>
-- ============================================================

-- 1) Coluna + geração automática no INSERT (import) + backfill
alter table public.projetos
  add column if not exists chamado_token text;

-- Preenche os projetos que já existem
update public.projetos
   set chamado_token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
 where chamado_token is null;

-- Novos projetos (inclusive via importação) recebem o token por padrão
alter table public.projetos
  alter column chamado_token
  set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

create unique index if not exists idx_projetos_chamado_token
  on public.projetos(chamado_token);

-- 2) RPC pública: resolve o projeto a partir do token (dados mínimos)
create or replace function public.fdl_obter_projeto_por_token(p_token text)
returns table (
  projeto_id uuid,
  cliente    text,
  shopping   text,
  cidade     text,
  uf         text,
  temporada  text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.cliente, p.shopping, p.cidade, p.uf, p.temporada
  from public.projetos p
  where p.chamado_token = nullif(trim(p_token), '')
  limit 1
$$;

revoke all on function public.fdl_obter_projeto_por_token(text) from public;
grant execute on function public.fdl_obter_projeto_por_token(text) to anon, authenticated;

-- 3) Conferência: copie os links gerados
-- select shopping, cliente, chamado_token from public.projetos order by shopping;
