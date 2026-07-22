-- ============================================================
-- PROGRESSO POR MUNDO — projeto-chave (Natal do Bem / prefeituras)
-- Rode no SQL Editor do Supabase (teste na preview antes da produção).
--
-- fdl_progresso_mundos(projeto): uma linha por mundo (etapa) com o progresso
-- VALIDADO ponderado por dias, na mesma régua do progresso do projeto:
--   - peso da OS = dias entre inicio_previsto e termino_previsto (mínimo 1);
--   - "validada" = status_validacao = 'aprovada' (aval da gestão);
--   - progresso do mundo = peso validado / peso total * 100.
-- Devolve também peso_total e peso_validado crus, para o cliente somar o
-- TOTAL do projeto exatamente como a soma ponderada dos mundos.
-- ============================================================

create or replace function public.fdl_progresso_mundos(p_projeto_id uuid)
returns table (
  etapa_id           uuid,
  codigo             text,
  nome               text,
  equipe             text,
  id_espaco          text,
  contrato           text,
  status_producao    text,
  total_os           integer,
  os_validadas       integer,
  os_aguardando      integer,
  os_em_andamento    integer,
  os_pendentes       integer,
  peso_total         numeric,
  peso_validado      numeric,
  progresso_validado numeric
)
language sql
security definer
set search_path = public, extensions
as $$
  with os_peso as (
    select
      o.etapa_id,
      o.status,
      o.status_validacao,
      greatest(
        1,
        coalesce(o.termino_previsto - o.inicio_previsto, 0) + 1
      )::numeric as peso
    from public.ordens_servico o
    where o.projeto_id = p_projeto_id
  )
  select
    ep.id                                                             as etapa_id,
    ep.codigo::text,
    ep.nome::text,
    ep.equipe::text,
    ep.id_espaco::text,
    ep.contrato::text,
    ep.status_producao::text,
    count(op.peso)::int                                               as total_os,
    count(*) filter (where op.status_validacao = 'aprovada')::int     as os_validadas,
    count(*) filter (where op.status = 'aguardando_validacao')::int   as os_aguardando,
    count(*) filter (where op.status = 'em_andamento')::int           as os_em_andamento,
    count(*) filter (where op.status = 'pendente')::int               as os_pendentes,
    coalesce(sum(op.peso), 0)                                         as peso_total,
    coalesce(sum(op.peso) filter (where op.status_validacao = 'aprovada'), 0)
                                                                      as peso_validado,
    round(
      coalesce(sum(op.peso) filter (where op.status_validacao = 'aprovada'), 0)
        / nullif(sum(op.peso), 0) * 100,
      2
    )                                                                 as progresso_validado
  from public.etapas_projeto ep
  left join os_peso op on op.etapa_id = ep.id
  where ep.projeto_id = p_projeto_id
  group by
    ep.id, ep.codigo, ep.nome, ep.equipe, ep.id_espaco,
    ep.contrato, ep.status_producao, ep.ordem
  order by ep.ordem nulls last, ep.codigo;
$$;

revoke all on function public.fdl_progresso_mundos(uuid) from public, anon;
grant execute on function public.fdl_progresso_mundos(uuid) to authenticated;
