-- ============================================================================
-- FÁBRICA DE LUZ — FECHAMENTO DE TEMPORADA (ocorrências + relatórios)
-- ============================================================================
-- Cole no SQL Editor do Supabase e execute. Idempotente.
--
-- Parte 1 (captura): estende o CHECK de registros_diarios.tipo_registro para
--   aceitar os tipos de "ocorrência" que o montador lança no registro da OS.
-- Parte 2 (relatório): RPCs de agregação por temporada (serão adicionadas
--   nesta fase seguinte).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Ocorrências: estende os tipos permitidos no registro diário
-- ----------------------------------------------------------------------------
alter table public.registros_diarios
  drop constraint if exists registros_diarios_tipo_registro_check;

alter table public.registros_diarios
  add constraint registros_diarios_tipo_registro_check
  check (tipo_registro = any (array[
    -- tipos existentes
    'acompanhamento', 'inicio_os', 'conclusao_os', 'pendencia', 'observacao', 'anexo',
    -- ocorrências (dia sem atividade / imprevistos) para o fechamento da temporada
    'ocorr_chuva', 'ocorr_logistica', 'ocorr_acesso', 'ocorr_material',
    'ocorr_retrabalho', 'ocorr_erro_projeto', 'ocorr_evento', 'ocorr_outro'
  ]));

-- ----------------------------------------------------------------------------
-- 2) RPC criar_registro_os_montador: aceitar também os tipos de ocorrência
-- ----------------------------------------------------------------------------
-- Mesma função de antes; a única mudança é a lista de tipos válidos, que agora
-- inclui os "ocorr_*". (create or replace — pode rodar por cima.)
create or replace function public.criar_registro_os_montador(
  p_usuario_id uuid,
  p_projeto_id uuid,
  p_os_id uuid,
  p_tipo_registro text,
  p_descricao text,
  p_percentual_execucao integer
)
returns table(
  registro_id uuid,
  tipo_registro text,
  status_informado text,
  descricao text,
  percentual_execucao integer,
  criado_em timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tipo text;
  v_status text;
  v_percentual integer;
  v_registro_id uuid;
begin
  v_tipo := lower(trim(coalesce(p_tipo_registro, 'acompanhamento')));

  if v_tipo not in (
    'acompanhamento',
    'inicio_os',
    'conclusao_os',
    'pendencia',
    'observacao',
    -- ocorrências (dia sem atividade / imprevistos)
    'ocorr_chuva',
    'ocorr_logistica',
    'ocorr_acesso',
    'ocorr_material',
    'ocorr_retrabalho',
    'ocorr_erro_projeto',
    'ocorr_evento',
    'ocorr_outro'
  ) then
    raise exception 'Tipo de registro inválido: %', p_tipo_registro;
  end if;

  if not exists (
    select 1
    from public.projeto_usuarios pu
    where pu.usuario_id = p_usuario_id
      and pu.projeto_id = p_projeto_id
  ) then
    raise exception 'Montador sem vínculo com este projeto.';
  end if;

  select os.status::text
  into v_status
  from public.ordens_servico os
  where os.id = p_os_id
    and os.projeto_id = p_projeto_id
  limit 1;

  if v_status is null then
    raise exception 'OS não encontrada neste projeto.';
  end if;

  v_percentual := greatest(0, least(100, coalesce(p_percentual_execucao, 0)));

  insert into public.registros_diarios (
    projeto_id,
    os_id,
    usuario_id,
    tipo_registro,
    status_informado,
    descricao,
    percentual_execucao
  )
  values (
    p_projeto_id,
    p_os_id,
    p_usuario_id,
    v_tipo,
    v_status,
    nullif(trim(coalesce(p_descricao, '')), ''),
    v_percentual
  )
  returning id into v_registro_id;

  return query
  select
    rd.id,
    rd.tipo_registro::text,
    rd.status_informado::text,
    rd.descricao::text,
    rd.percentual_execucao,
    rd.criado_em
  from public.registros_diarios rd
  where rd.id = v_registro_id;
end;
$function$;
