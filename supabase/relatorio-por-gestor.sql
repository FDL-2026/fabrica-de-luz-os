-- ============================================================================
-- FECHAMENTO DA TEMPORADA — ABERTURA DE SLA POR GESTOR
-- Cole no SQL Editor do Supabase e execute. Idempotente.
--
-- Referencia a tabela de CHAMADOS (public.chamados). Rode onde o
-- supabase/chamados.sql já foi aplicado.
--
-- Mesma lógica de SLA do resumo geral, agrupada por responsável comercial
-- (gestor). Escopo: gestor comercial vê só os projetos dele; admin/diretor/
-- gerente_operacional veem todos.
-- ============================================================================

create or replace function public.fdl_relatorio_sla_por_gestor(p_temporada text)
returns table (
  gestor              text,
  projetos            bigint,
  total_os            bigint,
  os_no_prazo         bigint,
  os_atrasadas        bigint,
  pct_sla_os          integer,
  dias_atraso_os      bigint,
  projetos_avaliados  bigint,
  projetos_no_prazo   bigint,
  pct_sla_projeto     integer,
  ocorrencias_total   bigint,
  chamados_total      bigint,
  chamados_no_prazo   bigint,
  pct_sla_chamados    integer
)
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text; v_todos boolean;
begin
  select nome, todos into v_nome, v_todos from public.fdl_rel_ator();
  if v_nome is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;

  return query
  with proj as (
    select
      p.id,
      coalesce(nullif(trim(p.responsavel_comercial), ''), 'Sem gestor')::text as gestor,
      p.data_fim
    from public.projetos p
    where p.temporada = p_temporada
      and (v_todos or p.responsavel_comercial = v_nome)
  ),
  oss as (
    select
      pr.gestor,
      case when o.concluido_em is not null and o.termino_previsto is not null then (o.concluido_em::date <= o.termino_previsto)
           when o.termino_previsto is not null and o.termino_previsto < current_date then false
           else null end as no_prazo,
      case when o.concluido_em is not null and o.termino_previsto is not null then greatest(0, (o.concluido_em::date - o.termino_previsto))
           when o.termino_previsto is not null and o.termino_previsto < current_date then (current_date - o.termino_previsto)
           else 0 end as dias_atraso
    from public.ordens_servico o
    join proj pr on pr.id = o.projeto_id
    where coalesce(o.status, '') <> 'cancelada'
  ),
  os_agg as (
    select
      gestor,
      count(*) as total_os,
      count(*) filter (where no_prazo is true) as os_no_prazo,
      count(*) filter (where no_prazo is false) as os_atrasadas,
      count(*) filter (where no_prazo is not null) as os_aval,
      coalesce(sum(dias_atraso), 0) as dias_atraso_os
    from oss group by gestor
  ),
  projstat as (
    select
      pr.id, pr.gestor, pr.data_fim,
      count(o.id) filter (where coalesce(o.status, '') <> 'cancelada') as total_os,
      count(o.id) filter (where o.concluido_em is not null and coalesce(o.status, '') <> 'cancelada') as concluidas,
      max(o.concluido_em) filter (where coalesce(o.status, '') <> 'cancelada') as ult
    from proj pr
    left join public.ordens_servico o on o.projeto_id = pr.id
    group by pr.id, pr.gestor, pr.data_fim
  ),
  projsla as (
    select
      gestor,
      case when total_os > 0 and concluidas = total_os then (ult::date <= data_fim)
           when data_fim is not null and data_fim < current_date then false
           else null end as no_prazo
    from projstat
  ),
  proj_agg as (
    select
      gestor,
      count(*) as projetos,
      count(*) filter (where no_prazo is not null) as projetos_avaliados,
      count(*) filter (where no_prazo is true) as projetos_no_prazo
    from projsla group by gestor
  ),
  ocor_agg as (
    select pr.gestor, count(*) as ocorrencias_total
    from public.registros_diarios rd
    join proj pr on pr.id = rd.projeto_id
    where rd.tipo_registro like 'ocorr%'
    group by pr.gestor
  ),
  cham_agg as (
    select
      pr.gestor,
      count(*) as chamados_total,
      count(*) filter (where (extract(epoch from (coalesce(c.resolvido_em, now()) - c.criado_em)) / 3600.0
              <= (case when c.prioridade in ('urgente', 'alta') then 24 else 72 end))) as chamados_no_prazo
    from public.chamados c
    join proj pr on pr.id = c.projeto_id
    where coalesce(c.status, '') <> 'cancelado'
    group by pr.gestor
  ),
  gestores as (select distinct gestor from proj)
  select
    g.gestor,
    coalesce(pa.projetos, 0),
    coalesce(oa.total_os, 0),
    coalesce(oa.os_no_prazo, 0),
    coalesce(oa.os_atrasadas, 0),
    (case when coalesce(oa.os_aval, 0) = 0 then 0
          else round(100.0 * oa.os_no_prazo / oa.os_aval) end)::integer,
    coalesce(oa.dias_atraso_os, 0),
    coalesce(pa.projetos_avaliados, 0),
    coalesce(pa.projetos_no_prazo, 0),
    (case when coalesce(pa.projetos_avaliados, 0) = 0 then 0
          else round(100.0 * pa.projetos_no_prazo / pa.projetos_avaliados) end)::integer,
    coalesce(oc.ocorrencias_total, 0),
    coalesce(ca.chamados_total, 0),
    coalesce(ca.chamados_no_prazo, 0),
    (case when coalesce(ca.chamados_total, 0) = 0 then 0
          else round(100.0 * ca.chamados_no_prazo / ca.chamados_total) end)::integer
  from gestores g
  left join os_agg oa   on oa.gestor = g.gestor
  left join proj_agg pa on pa.gestor = g.gestor
  left join ocor_agg oc on oc.gestor = g.gestor
  left join cham_agg ca on ca.gestor = g.gestor
  order by g.gestor;
end;
$$;

revoke all on function public.fdl_relatorio_sla_por_gestor(text) from public, anon;
grant execute on function public.fdl_relatorio_sla_por_gestor(text) to authenticated;
