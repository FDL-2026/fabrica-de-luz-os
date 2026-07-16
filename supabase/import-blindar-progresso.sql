-- ============================================================
-- IMPORTAÇÃO DE CRONOGRAMA — BLINDAR O QUE JÁ FOI FEITO
-- Rode no SQL Editor do Supabase (teste na preview antes da produção).
--
-- Mudança única em relação à função atual: ao ATUALIZAR uma OS que já
-- existe, a reimportação NÃO toca mais em:
--     progresso, inicio_real, duracao_real, termino_real
-- (esses refletem o trabalho de campo). A planilha continua atualizando
-- local, serviço, equipe, etapa, datas previstas e responsável; e as OSs
-- NOVAS continuam sendo criadas normalmente.
--
-- Status, validação e registros do montador já não eram tocados.
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirmar_importacao_cronograma(p_payload jsonb, p_usuario_id uuid)
 RETURNS TABLE(projeto_id uuid, projeto_nome text, etapas_processadas integer, os_criadas integer, os_atualizadas integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_projeto_id uuid;
  v_projeto_nome text;
  v_cliente text;
  v_shopping text;
  v_cidade text;
  v_uf text;
  v_temporada text;
  v_inicio date;
  v_fim date;
  v_temporada_tipo text;

  v_etapa jsonb;
  v_os jsonb;

  v_etapa_id uuid;
  v_os_id uuid;

  v_codigo_etapa text;
  v_codigo_os text;

  v_etapas_processadas integer := 0;
  v_os_criadas integer := 0;
  v_os_atualizadas integer := 0;
begin
  v_cliente := nullif(trim(coalesce(p_payload->>'cliente', '')), '');
  v_shopping := nullif(trim(coalesce(p_payload->>'shopping', '')), '');
  v_cidade := nullif(trim(coalesce(p_payload->>'cidade', '')), '');
  v_uf := upper(left(nullif(trim(coalesce(p_payload->>'uf', '')), ''), 2));
  v_temporada := nullif(trim(coalesce(p_payload->>'temporada', '2026')), '');

  if v_cliente is null then
    v_cliente := v_shopping;
  end if;

  if v_shopping is null then
    v_shopping := v_cliente;
  end if;

  if v_cidade is null then
    v_cidade := 'Não informado';
  end if;

  if v_uf is null or v_uf = '' then
    v_uf := 'NI';
  end if;

  if v_temporada is null then
    v_temporada := '2026';
  end if;

  v_inicio := public.fdl_parse_date(p_payload->>'inicioOperacoes');

  select public.fdl_parse_date(etapa->>'terminoPrevisto')
  into v_fim
  from jsonb_array_elements(coalesce(p_payload->'etapas', '[]'::jsonb)) etapa
  where public.fdl_parse_date(etapa->>'terminoPrevisto') is not null
  order by public.fdl_parse_date(etapa->>'terminoPrevisto') desc
  limit 1;

  select c.data_type
  into v_temporada_tipo
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'projetos'
    and c.column_name = 'temporada'
  limit 1;

  select p.id
  into v_projeto_id
  from public.projetos p
  where
    upper(coalesce(p.shopping::text, p.cliente::text, '')) = upper(v_shopping)
    and upper(coalesce(p.uf::text, '')) = upper(v_uf)
    and p.temporada::text = v_temporada
  limit 1;

  if v_projeto_id is null then
    if v_temporada_tipo in ('integer', 'bigint', 'numeric', 'smallint') then
      insert into public.projetos (
        cliente,
        shopping,
        cidade,
        uf,
        temporada,
        status,
        data_inicio,
        data_fim,
        observacoes
      )
      values (
        v_cliente,
        v_shopping,
        v_cidade,
        v_uf::char(2),
        v_temporada::integer,
        'planejamento',
        v_inicio,
        v_fim,
        'Projeto criado automaticamente pela importação de cronograma.'
      )
      returning id into v_projeto_id;
    else
      insert into public.projetos (
        cliente,
        shopping,
        cidade,
        uf,
        temporada,
        status,
        data_inicio,
        data_fim,
        observacoes
      )
      values (
        v_cliente,
        v_shopping,
        v_cidade,
        v_uf::char(2),
        v_temporada,
        'planejamento',
        v_inicio,
        v_fim,
        'Projeto criado automaticamente pela importação de cronograma.'
      )
      returning id into v_projeto_id;
    end if;
  else
    if v_temporada_tipo in ('integer', 'bigint', 'numeric', 'smallint') then
      update public.projetos p
      set
        cliente = v_cliente,
        shopping = v_shopping,
        cidade = v_cidade,
        uf = v_uf::char(2),
        temporada = v_temporada::integer,
        data_inicio = coalesce(v_inicio, p.data_inicio),
        data_fim = coalesce(v_fim, p.data_fim)
      where p.id = v_projeto_id;
    else
      update public.projetos p
      set
        cliente = v_cliente,
        shopping = v_shopping,
        cidade = v_cidade,
        uf = v_uf::char(2),
        temporada = v_temporada,
        data_inicio = coalesce(v_inicio, p.data_inicio),
        data_fim = coalesce(v_fim, p.data_fim)
      where p.id = v_projeto_id;
    end if;
  end if;

  if not exists (
    select 1
    from public.projeto_usuarios pu
    where pu.projeto_id = v_projeto_id
      and pu.usuario_id = p_usuario_id
  ) then
    insert into public.projeto_usuarios (
      projeto_id,
      usuario_id,
      funcao
    )
    values (
      v_projeto_id,
      p_usuario_id,
      'importador'
    );
  end if;

  for v_etapa in
    select value
    from jsonb_array_elements(coalesce(p_payload->'etapas', '[]'::jsonb))
  loop
    v_codigo_etapa := nullif(trim(coalesce(v_etapa->>'id', '')), '');

    if v_codigo_etapa is null then
      continue;
    end if;

    select ep.id
    into v_etapa_id
    from public.etapas_projeto ep
    where ep.projeto_id = v_projeto_id
      and ep.codigo = v_codigo_etapa
    limit 1;

    if v_etapa_id is null then
      insert into public.etapas_projeto (
        projeto_id,
        codigo,
        nome,
        inicio_previsto,
        termino_previsto,
        responsavel_comercial,
        equipe,
        ordem
      )
      values (
        v_projeto_id,
        v_codigo_etapa,
        coalesce(nullif(v_etapa->>'tarefa', ''), 'Etapa sem nome'),
        public.fdl_parse_date(v_etapa->>'inicioPrevisto'),
        public.fdl_parse_date(v_etapa->>'terminoPrevisto'),
        nullif(v_etapa->>'responsavelComercial', ''),
        nullif(v_etapa->>'equipe', ''),
        case
          when v_codigo_etapa ~ '^\d+$' then v_codigo_etapa::integer
          else null
        end
      )
      returning id into v_etapa_id;
    else
      update public.etapas_projeto ep
      set
        nome = coalesce(nullif(v_etapa->>'tarefa', ''), ep.nome),
        inicio_previsto = public.fdl_parse_date(v_etapa->>'inicioPrevisto'),
        termino_previsto = public.fdl_parse_date(v_etapa->>'terminoPrevisto'),
        responsavel_comercial = nullif(v_etapa->>'responsavelComercial', ''),
        equipe = nullif(v_etapa->>'equipe', ''),
        atualizado_em = now()
      where ep.id = v_etapa_id;
    end if;

    v_etapas_processadas := v_etapas_processadas + 1;
  end loop;

  for v_os in
    select value
    from jsonb_array_elements(coalesce(p_payload->'ordensServico', '[]'::jsonb))
  loop
    v_codigo_os := nullif(trim(coalesce(v_os->>'id', '')), '');

    if v_codigo_os is null then
      continue;
    end if;

    v_codigo_etapa := nullif(trim(coalesce(v_os->>'etapaId', '')), '');

    select ep.id
    into v_etapa_id
    from public.etapas_projeto ep
    where ep.projeto_id = v_projeto_id
      and ep.codigo = v_codigo_etapa
    limit 1;

    select os.id
    into v_os_id
    from public.ordens_servico os
    where os.projeto_id = v_projeto_id
      and os.codigo_os = v_codigo_os
    limit 1;

    if v_os_id is null then
      -- OS NOVA: entra pendente e pega o progresso inicial da planilha.
      insert into public.ordens_servico (
        projeto_id,
        codigo_os,
        local,
        servico,
        equipe,
        status,
        etapa_id,
        codigo_cronograma,
        inicio_previsto,
        duracao_prevista,
        termino_previsto,
        inicio_real,
        duracao_real,
        termino_real,
        progresso,
        responsavel_comercial
      )
      values (
        v_projeto_id,
        v_codigo_os,
        nullif(v_os->>'etapaNome', ''),
        coalesce(nullif(v_os->>'tarefa', ''), 'OS sem descrição'),
        nullif(v_os->>'equipe', ''),
        'pendente',
        v_etapa_id,
        v_codigo_os,
        public.fdl_parse_date(v_os->>'inicioPrevisto'),
        public.fdl_parse_numero(v_os->>'duracaoPrevista'),
        public.fdl_parse_date(v_os->>'terminoPrevisto'),
        public.fdl_parse_date(v_os->>'inicioReal'),
        public.fdl_parse_numero(v_os->>'duracaoReal'),
        public.fdl_parse_date(v_os->>'terminoReal'),
        public.fdl_parse_numero(v_os->>'progresso'),
        nullif(v_os->>'responsavelComercial', '')
      );

      v_os_criadas := v_os_criadas + 1;
    else
      -- OS EXISTENTE: atualiza só o estrutural/planejado. NÃO toca em
      -- progresso nem na execução real (inicio_real, duracao_real,
      -- termino_real) — isso é preservado do trabalho de campo.
      update public.ordens_servico os
      set
        local = nullif(v_os->>'etapaNome', ''),
        servico = coalesce(nullif(v_os->>'tarefa', ''), os.servico),
        equipe = nullif(v_os->>'equipe', ''),
        etapa_id = v_etapa_id,
        codigo_cronograma = v_codigo_os,
        inicio_previsto = public.fdl_parse_date(v_os->>'inicioPrevisto'),
        duracao_prevista = public.fdl_parse_numero(v_os->>'duracaoPrevista'),
        termino_previsto = public.fdl_parse_date(v_os->>'terminoPrevisto'),
        responsavel_comercial = nullif(v_os->>'responsavelComercial', '')
      where os.id = v_os_id;

      v_os_atualizadas := v_os_atualizadas + 1;
    end if;
  end loop;

  begin
    insert into public.importacoes_cronograma (
      projeto_id,
      arquivo,
      aba,
      total_etapas,
      total_os,
      status,
      payload,
      criado_por
    )
    values (
      v_projeto_id,
      p_payload->>'arquivo',
      p_payload->>'aba',
      v_etapas_processadas,
      v_os_criadas + v_os_atualizadas,
      'concluida',
      p_payload,
      p_usuario_id
    );
  exception
    when others then
      null;
  end;

  select coalesce(p.cliente::text, p.shopping::text)
  into v_projeto_nome
  from public.projetos p
  where p.id = v_projeto_id;

  return query
  select
    v_projeto_id as projeto_id,
    v_projeto_nome as projeto_nome,
    v_etapas_processadas as etapas_processadas,
    v_os_criadas as os_criadas,
    v_os_atualizadas as os_atualizadas;
end;
$function$;
