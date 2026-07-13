-- ============================================================================
-- FÁBRICA DE LUZ — RPCs DO RELATÓRIO DE FECHAMENTO DA TEMPORADA
-- ============================================================================
-- Cole no SQL Editor do Supabase (ambiente de PREVIEW) e execute. Idempotente.
--
-- ATENÇÃO: este arquivo referencia as tabelas de CHAMADOS (public.chamados).
-- Rode SOMENTE em um ambiente onde o supabase/chamados.sql já foi aplicado.
-- Não rode em produção enquanto os chamados não estiverem promovidos.
--
-- Cria: fdl_rel_ator (helper), fdl_listar_temporadas,
--       fdl_relatorio_resumo_temporada, fdl_relatorio_sla_os,
--       fdl_relatorio_sla_projeto, fdl_relatorio_ocorrencias,
--       fdl_relatorio_sla_chamados.
--
-- Escopo: gestor comercial vê só os projetos dele (responsavel_comercial);
--         admin/diretor/gerente_operacional veem tudo.
-- SLA de chamados: urgente/alta = 24h, média/baixa = 72h (criado_em -> resolvido).
-- ============================================================================

-- Helper: identifica o chamador e se tem visão total
create or replace function public.fdl_rel_ator()
returns table (nome text, perfil text, todos boolean)
language sql
security definer
set search_path = public
as $$
  select u.nome::text, u.perfil::text,
         (u.perfil in ('admin', 'diretor', 'gerente_operacional')) as todos
  from public.usuarios u
  where u.auth_user_id = auth.uid() and coalesce(u.ativo, true)
$$;

revoke all on function public.fdl_rel_ator() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Temporadas disponíveis (para o seletor)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_listar_temporadas()
returns table (temporada text)
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text; v_todos boolean;
begin
  select nome, todos into v_nome, v_todos from public.fdl_rel_ator();
  if v_nome is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;

  return query
  select distinct p.temporada::text
  from public.projetos p
  where p.temporada is not null
    and (v_todos or p.responsavel_comercial = v_nome)
  order by p.temporada::text desc;
end;
$$;

revoke all on function public.fdl_listar_temporadas() from public, anon;
grant execute on function public.fdl_listar_temporadas() to authenticated;

-- ----------------------------------------------------------------------------
-- SLA por OS (concluída até o termino_previsto)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_relatorio_sla_os(p_temporada text)
returns table (
  projeto text, uf text, codigo text, servico text,
  termino_previsto date, concluido_em timestamptz,
  no_prazo boolean, dias_atraso integer, status text
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
  select
    coalesce(p.cliente, p.shopping)::text,
    trim(p.uf)::text,
    coalesce(os.codigo_cronograma, os.codigo_os)::text,
    os.servico::text,
    os.termino_previsto,
    os.concluido_em,
    case when os.concluido_em is not null then (os.concluido_em::date <= os.termino_previsto)
         when os.termino_previsto < current_date then false
         else null end,
    case when os.concluido_em is not null then greatest(0, (os.concluido_em::date - os.termino_previsto))
         when os.termino_previsto < current_date then (current_date - os.termino_previsto)
         else 0 end,
    os.status::text
  from public.ordens_servico os
  join public.projetos p on p.id = os.projeto_id
  where p.temporada = p_temporada
    and coalesce(os.status, '') <> 'cancelada'
    and os.termino_previsto is not null
    and (v_todos or p.responsavel_comercial = v_nome)
  order by coalesce(p.shopping, p.cliente), os.termino_previsto;
end;
$$;

revoke all on function public.fdl_relatorio_sla_os(text) from public, anon;
grant execute on function public.fdl_relatorio_sla_os(text) to authenticated;

-- ----------------------------------------------------------------------------
-- SLA por projeto (montagem concluída até o data_fim)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_relatorio_sla_projeto(p_temporada text)
returns table (
  projeto text, uf text, gestor text, data_fim date,
  conclusao timestamptz, no_prazo boolean, dias_atraso integer,
  total_os bigint, concluidas bigint
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
  with base as (
    select
      p.id,
      coalesce(p.cliente, p.shopping)::text as projeto,
      trim(p.uf)::text as uf,
      p.responsavel_comercial::text as gestor,
      p.data_fim,
      count(os.id) filter (where coalesce(os.status, '') <> 'cancelada') as total_os,
      count(os.id) filter (where os.concluido_em is not null and coalesce(os.status, '') <> 'cancelada') as concluidas,
      max(os.concluido_em) filter (where coalesce(os.status, '') <> 'cancelada') as ult
    from public.projetos p
    left join public.ordens_servico os on os.projeto_id = p.id
    where p.temporada = p_temporada
      and (v_todos or p.responsavel_comercial = v_nome)
    group by p.id, p.cliente, p.shopping, p.uf, p.responsavel_comercial, p.data_fim
  )
  select
    b.projeto, b.uf, b.gestor, b.data_fim,
    case when b.total_os > 0 and b.concluidas = b.total_os then b.ult else null end,
    case when b.total_os > 0 and b.concluidas = b.total_os then (b.ult::date <= b.data_fim)
         when b.data_fim is not null and b.data_fim < current_date then false
         else null end,
    case when b.total_os > 0 and b.concluidas = b.total_os then greatest(0, (b.ult::date - b.data_fim))
         when b.data_fim is not null and b.data_fim < current_date then (current_date - b.data_fim)
         else 0 end,
    b.total_os, b.concluidas
  from base b
  order by b.projeto;
end;
$$;

revoke all on function public.fdl_relatorio_sla_projeto(text) from public, anon;
grant execute on function public.fdl_relatorio_sla_projeto(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Ocorrências (registros ocorr_* na temporada)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_relatorio_ocorrencias(p_temporada text)
returns table (
  projeto text, uf text, data timestamptz,
  tipo text, descricao text, montador text
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
  select
    coalesce(p.cliente, p.shopping)::text,
    trim(p.uf)::text,
    rd.criado_em,
    rd.tipo_registro::text,
    rd.descricao::text,
    u.nome::text
  from public.registros_diarios rd
  join public.projetos p on p.id = rd.projeto_id
  left join public.usuarios u on u.id = rd.usuario_id
  where p.temporada = p_temporada
    and rd.tipo_registro like 'ocorr%'
    and (v_todos or p.responsavel_comercial = v_nome)
  order by rd.criado_em desc;
end;
$$;

revoke all on function public.fdl_relatorio_ocorrencias(text) from public, anon;
grant execute on function public.fdl_relatorio_ocorrencias(text) to authenticated;

-- ----------------------------------------------------------------------------
-- SLA de chamados (24h urgente/alta, 72h média/baixa; criado -> resolvido)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_relatorio_sla_chamados(p_temporada text)
returns table (
  protocolo text, projeto text, prioridade text,
  aberto_em timestamptz, resolvido_em timestamptz,
  horas numeric, prazo_horas integer, cumpriu boolean
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
  select
    c.protocolo::text,
    coalesce(p.cliente, p.shopping)::text,
    c.prioridade::text,
    c.criado_em,
    c.resolvido_em,
    round(extract(epoch from (coalesce(c.resolvido_em, now()) - c.criado_em)) / 3600.0, 1)::numeric,
    (case when c.prioridade in ('urgente', 'alta') then 24 else 72 end)::integer,
    (extract(epoch from (coalesce(c.resolvido_em, now()) - c.criado_em)) / 3600.0
       <= (case when c.prioridade in ('urgente', 'alta') then 24 else 72 end))
  from public.chamados c
  join public.projetos p on p.id = c.projeto_id
  where p.temporada = p_temporada
    and coalesce(c.status, '') <> 'cancelado'
    and (v_todos or p.responsavel_comercial = v_nome)
  order by c.criado_em desc;
end;
$$;

revoke all on function public.fdl_relatorio_sla_chamados(text) from public, anon;
grant execute on function public.fdl_relatorio_sla_chamados(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Resumo agregado da temporada (jsonb)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_relatorio_resumo_temporada(p_temporada text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text; v_todos boolean; v jsonb;
begin
  select nome, todos into v_nome, v_todos from public.fdl_rel_ator();
  if v_nome is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;

  with proj as (
    select p.* from public.projetos p
    where p.temporada = p_temporada
      and (v_todos or p.responsavel_comercial = v_nome)
  ),
  oss as (
    select
      o.concluido_em, o.status, o.termino_previsto,
      case when o.concluido_em is not null then (o.concluido_em::date <= o.termino_previsto)
           when o.termino_previsto < current_date then false else null end as no_prazo,
      case when o.concluido_em is not null then greatest(0, (o.concluido_em::date - o.termino_previsto))
           when o.termino_previsto < current_date then (current_date - o.termino_previsto)
           else 0 end as dias_atraso
    from public.ordens_servico o
    join proj p on p.id = o.projeto_id
    where coalesce(o.status, '') <> 'cancelada'
  ),
  oss_sla as (select * from oss where termino_previsto is not null),
  projstat as (
    select p.id, p.data_fim,
      count(o.id) filter (where coalesce(o.status, '') <> 'cancelada') as total_os,
      count(o.id) filter (where o.concluido_em is not null and coalesce(o.status, '') <> 'cancelada') as concluidas,
      max(o.concluido_em) filter (where coalesce(o.status, '') <> 'cancelada') as ult
    from proj p
    left join public.ordens_servico o on o.projeto_id = p.id
    group by p.id, p.data_fim
  ),
  projsla as (
    select case when total_os > 0 and concluidas = total_os then (ult::date <= data_fim)
                when data_fim is not null and data_fim < current_date then false
                else null end as no_prazo
    from projstat
  ),
  ocor as (
    select rd.tipo_registro, count(*) as qtd
    from public.registros_diarios rd
    join proj p on p.id = rd.projeto_id
    where rd.tipo_registro like 'ocorr%'
    group by rd.tipo_registro
  ),
  cham as (
    select (extract(epoch from (coalesce(c.resolvido_em, now()) - c.criado_em)) / 3600.0
              <= (case when c.prioridade in ('urgente', 'alta') then 24 else 72 end)) as cumpriu
    from public.chamados c
    join proj p on p.id = c.projeto_id
    where coalesce(c.status, '') <> 'cancelado'
  )
  select jsonb_build_object(
    'total_projetos', (select count(*) from proj),
    'total_os', (select count(*) from oss),
    'os_concluidas', (select count(*) from oss where concluido_em is not null),
    'os_no_prazo', (select count(*) from oss_sla where no_prazo is true),
    'os_atrasadas', (select count(*) from oss_sla where no_prazo is false),
    'pct_sla_os', (select case when count(*) filter (where no_prazo is not null) = 0 then 0
        else round(100.0 * count(*) filter (where no_prazo is true) / count(*) filter (where no_prazo is not null)) end from oss_sla),
    'dias_atraso_os', (select coalesce(sum(dias_atraso), 0) from oss_sla),
    'projetos_avaliados', (select count(*) from projsla where no_prazo is not null),
    'projetos_no_prazo', (select count(*) from projsla where no_prazo is true),
    'pct_sla_projeto', (select case when count(*) filter (where no_prazo is not null) = 0 then 0
        else round(100.0 * count(*) filter (where no_prazo is true) / count(*) filter (where no_prazo is not null)) end from projsla),
    'ocorrencias_total', (select coalesce(sum(qtd), 0) from ocor),
    'ocorrencias_por_tipo', (select coalesce(jsonb_object_agg(tipo_registro, qtd), '{}'::jsonb) from ocor),
    'chamados_total', (select count(*) from cham),
    'chamados_no_prazo', (select count(*) from cham where cumpriu is true),
    'pct_sla_chamados', (select case when count(*) = 0 then 0
        else round(100.0 * count(*) filter (where cumpriu is true) / count(*)) end from cham)
  ) into v;

  return v;
end;
$$;

revoke all on function public.fdl_relatorio_resumo_temporada(text) from public, anon;
grant execute on function public.fdl_relatorio_resumo_temporada(text) to authenticated;
