-- ============================================================
-- HISTÓRICO DE CHAMADOS POR LINK DO SHOPPING
-- Rode no SQL Editor do Supabase.
--
-- Lista pública (para quem tem o link do shopping) dos chamados
-- daquele projeto, com o status de cada um. Retorna apenas campos
-- que o próprio cliente já informou — sem notas internas do gestor.
-- ============================================================

create or replace function public.fdl_listar_chamados_projeto_token(p_token text)
returns table (
  protocolo    text,
  titulo       text,
  categoria    text,
  prioridade   text,
  status       text,
  criado_em    timestamptz,
  resolvido_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.protocolo::text,
    c.titulo::text,
    c.categoria::text,
    c.prioridade::text,
    c.status::text,
    c.criado_em,
    c.resolvido_em
  from public.chamados c
  join public.projetos p on p.id = c.projeto_id
  where p.chamado_token = nullif(trim(p_token), '')
  order by c.criado_em desc
  limit 100
$$;

revoke all on function public.fdl_listar_chamados_projeto_token(text) from public;
grant execute on function public.fdl_listar_chamados_projeto_token(text) to anon, authenticated;
