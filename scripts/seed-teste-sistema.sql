-- ============================================================================
-- FÁBRICA DE LUZ OS — SEED DE TESTE DO SISTEMA
-- ============================================================================
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Ele roda em uma única transação: se algo falhar, nada é alterado.
--
-- O que este script faz:
--   1. Cria as contas de acesso (login por e-mail) para:
--      - Gestores comerciais: Bruno Koga, Lucas Borges, Acácio Pires,
--        Arthur Palhares e Hiron Mendes
--      - Gerente operacional: Wagner Vilela
--      - Diretores: Bruno Cruz e Pedro Minasi
--      Senha provisória de todos: Fdl@2026
--   2. Cria os montadores (login por Código + PIN, PIN 1234):
--      Marcos Maia (MARCOS), Aryane (ARYANE), Judson (JUDSON),
--      Daniel (DANIEL), Carlos Magno (CMAGNO), Patrick (PATRICK)
--   3. Mantém apenas os 80 projetos mais recentes (apaga o restante,
--      incluindo OSs, noites de montagem, registros e demais vínculos).
--   4. Distribui os 80 projetos entre os 5 gestores comerciais (16 cada,
--      rodízio) e vincula na equipe de cada projeto o gestor responsável,
--      o Wagner Vilela e um montador (rodízio entre os 6).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) Contas com login por e-mail (gestores, gerente operacional e diretores)
-- ----------------------------------------------------------------------------
do $$
declare
  v_senha   text  := 'Fdl@2026';
  v_pessoas jsonb := '[
    {"nome": "Bruno Koga",      "email": "bruno.koga@fdl-teste.com.br",      "perfil": "gestor_comercial"},
    {"nome": "Lucas Borges",    "email": "lucas.borges@fdl-teste.com.br",    "perfil": "gestor_comercial"},
    {"nome": "Acácio Pires",    "email": "acacio.pires@fdl-teste.com.br",    "perfil": "gestor_comercial"},
    {"nome": "Arthur Palhares", "email": "arthur.palhares@fdl-teste.com.br", "perfil": "gestor_comercial"},
    {"nome": "Hiron Mendes",    "email": "hiron.mendes@fdl-teste.com.br",    "perfil": "gestor_comercial"},
    {"nome": "Wagner Vilela",   "email": "wagner.vilela@fdl-teste.com.br",   "perfil": "gerente_operacional"},
    {"nome": "Bruno Cruz",      "email": "bruno.cruz@fdl-teste.com.br",      "perfil": "diretor"},
    {"nome": "Pedro Minasi",    "email": "pedro.minasi@fdl-teste.com.br",    "perfil": "diretor"}
  ]'::jsonb;
  v_item    jsonb;
  v_auth_id uuid;
begin
  for v_item in select * from jsonb_array_elements(v_pessoas) loop

    -- Conta de autenticação (auth.users), se ainda não existir
    select id into v_auth_id
    from auth.users
    where email = v_item->>'email';

    if v_auth_id is null then
      v_auth_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_auth_id,
        'authenticated',
        'authenticated',
        v_item->>'email',
        crypt(v_senha, gen_salt('bf')),
        now(),
        '', '', '', '',
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('nome', v_item->>'nome', 'perfil', v_item->>'perfil'),
        now(), now()
      );

      insert into auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_auth_id,
        v_auth_id::text,
        'email',
        jsonb_build_object(
          'sub', v_auth_id::text,
          'email', v_item->>'email',
          'email_verified', true
        ),
        now(), now(), now()
      );

      raise notice 'Conta de login criada: % (%)', v_item->>'nome', v_item->>'email';
    else
      raise notice 'Conta de login já existia: %', v_item->>'email';
    end if;

    -- Registro na tabela usuarios (via mesma RPC usada pelo app)
    if not exists (
      select 1 from public.usuarios where lower(coalesce(email, '')) = v_item->>'email'
    ) then
      perform public.fdl_salvar_usuario_gestao(
        p_nome         := v_item->>'nome',
        p_email        := v_item->>'email',
        p_perfil       := v_item->>'perfil',
        p_tipo_login   := 'email',
        p_codigo_acesso := null,
        p_pin          := null,
        p_auth_user_id := v_auth_id,
        p_ativo        := true
      );
      raise notice 'Usuário criado no sistema: % [%]', v_item->>'nome', v_item->>'perfil';
    else
      raise notice 'Usuário já existia no sistema: %', v_item->>'nome';
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2) Montadores (login por Código + PIN — PIN 1234 para todos)
-- ----------------------------------------------------------------------------
do $$
declare
  v_montadores jsonb := '[
    {"nome": "Marcos Maia",  "codigo": "MARCOS"},
    {"nome": "Aryane",       "codigo": "ARYANE"},
    {"nome": "Judson",       "codigo": "JUDSON"},
    {"nome": "Daniel",       "codigo": "DANIEL"},
    {"nome": "Carlos Magno", "codigo": "CMAGNO"},
    {"nome": "Patrick",      "codigo": "PATRICK"}
  ]'::jsonb;
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(v_montadores) loop
    if not exists (
      select 1 from public.usuarios
      where upper(coalesce(codigo_acesso, '')) = v_item->>'codigo'
    ) then
      perform public.fdl_salvar_usuario_gestao(
        p_nome         := v_item->>'nome',
        p_email        := null,
        p_perfil       := 'montador',
        p_tipo_login   := 'pin',
        p_codigo_acesso := v_item->>'codigo',
        p_pin          := '1234',
        p_auth_user_id := null,
        p_ativo        := true
      );
      raise notice 'Montador criado: % (código %, PIN 1234)', v_item->>'nome', v_item->>'codigo';
    else
      raise notice 'Montador já existia: % (código %)', v_item->>'nome', v_item->>'codigo';
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3) Manter apenas os 80 projetos mais recentes
--    (apaga em cascata tudo que referencia os projetos removidos)
-- ----------------------------------------------------------------------------
create or replace function pg_temp.fdl_purge(p_table regclass, p_ids uuid[], p_depth int default 0)
returns void
language plpgsql
as $fn$
declare
  fk          record;
  v_child_ids uuid[];
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    return;
  end if;

  if p_depth > 8 then
    raise exception 'Profundidade máxima de dependências excedida em %', p_table;
  end if;

  for fk in
    select con.conrelid::regclass as child_table,
           att.attname            as child_col
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum   = con.conkey[1]
    where con.contype   = 'f'
      and con.confrelid = p_table
  loop
    if fk.child_table = p_table then
      continue;
    end if;

    begin
      execute format(
        'select coalesce(array_agg(id), ''{}''::uuid[]) from %s where %I = any($1)',
        fk.child_table, fk.child_col
      ) into v_child_ids using p_ids;

      perform pg_temp.fdl_purge(fk.child_table, v_child_ids, p_depth + 1);
    exception when undefined_column then
      -- Tabela sem coluna "id": apaga direto pelas chaves do pai
      execute format('delete from %s where %I = any($1)', fk.child_table, fk.child_col)
        using p_ids;
    end;
  end loop;

  execute format('delete from %s where id = any($1)', p_table) using p_ids;
end;
$fn$;

do $$
declare
  v_remover uuid[];
begin
  select coalesce(array_agg(id), '{}'::uuid[]) into v_remover
  from (
    select id
    from public.projetos
    order by criado_em desc
    offset 80
  ) excedentes;

  raise notice 'Projetos a remover (mantendo os 80 mais recentes): %',
    coalesce(array_length(v_remover, 1), 0);

  perform pg_temp.fdl_purge('public.projetos'::regclass, v_remover);
end $$;

-- ----------------------------------------------------------------------------
-- 4) Distribuir os projetos entre os gestores comerciais e montar as equipes
-- ----------------------------------------------------------------------------
do $$
declare
  v_gestores   text[] := array['Bruno Koga', 'Lucas Borges', 'Acácio Pires', 'Arthur Palhares', 'Hiron Mendes'];
  v_montadores text[] := array['Marcos Maia', 'Aryane', 'Judson', 'Daniel', 'Carlos Magno', 'Patrick'];
  v_col_projeto text;
  v_col_os      text;
  v_link        text;
  v_tem_funcao  boolean := false;
begin
  -- Coluna do gestor comercial na tabela projetos
  select column_name into v_col_projeto
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'projetos'
    and column_name in ('responsavel_comercial', 'gestor_comercial', 'gestor')
  order by case column_name
             when 'responsavel_comercial' then 0
             when 'gestor_comercial'      then 1
             else 2
           end
  limit 1;

  if v_col_projeto is null then
    raise notice 'ATENÇÃO: coluna do gestor comercial não encontrada em projetos — distribuição pulada.';
  else
    execute format($sql$
      with ordenados as (
        select id, row_number() over (order by criado_em) as rn
        from public.projetos
      )
      update public.projetos p
         set %I = ($1)[1 + (o.rn - 1) %% cardinality($1)]
        from ordenados o
       where o.id = p.id
    $sql$, v_col_projeto)
    using v_gestores;

    raise notice 'Projetos distribuídos em rodízio entre % gestores (coluna projetos.%).',
      cardinality(v_gestores), v_col_projeto;
  end if;

  -- Replica o gestor nas OSs, se a coluna existir lá também
  select column_name into v_col_os
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'ordens_servico'
    and column_name in ('responsavel_comercial', 'gestor_comercial')
  limit 1;

  if v_col_os is not null and v_col_projeto is not null then
    execute format(
      'update public.ordens_servico os set %I = p.%I from public.projetos p where p.id = os.projeto_id',
      v_col_os, v_col_projeto
    );
    raise notice 'Gestor replicado nas OSs (coluna ordens_servico.%).', v_col_os;
  end if;

  -- Tabela de equipe do projeto (vínculo projeto x usuário)
  select c.table_name into v_link
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name  = 'projeto_id'
    and (c.table_name like '%equipe%' or c.table_name like '%usuario%')
    and exists (
      select 1
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name   = c.table_name
        and c2.column_name  = 'usuario_id'
    )
  order by case when c.table_name like '%equipe%' then 0 else 1 end
  limit 1;

  if v_link is null then
    raise notice 'ATENÇÃO: tabela de equipe não encontrada — vincule os usuários pela tela Equipe do projeto.';
    return;
  end if;

  v_tem_funcao := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = v_link
      and column_name  = 'funcao'
  );

  raise notice 'Montando equipes na tabela %.', v_link;

  -- 4a) Gestor comercial responsável entra na equipe do próprio projeto
  if v_col_projeto is not null then
    execute format($sql$
      insert into public.%1$I (projeto_id, usuario_id%2$s)
      select p.id, u.id%3$s
      from public.projetos p
      join public.usuarios u
        on u.nome = p.%4$I
       and u.perfil = 'gestor_comercial'
      where not exists (
        select 1 from public.%1$I e
        where e.projeto_id = p.id and e.usuario_id = u.id
      )
    $sql$,
      v_link,
      case when v_tem_funcao then ', funcao' else '' end,
      case when v_tem_funcao then ', ''gestor_comercial''' else '' end,
      v_col_projeto);
  end if;

  -- 4b) Gerente operacional (Wagner Vilela) em todos os projetos
  execute format($sql$
    insert into public.%1$I (projeto_id, usuario_id%2$s)
    select p.id, u.id%3$s
    from public.projetos p
    cross join public.usuarios u
    where u.nome = 'Wagner Vilela'
      and u.perfil = 'gerente_operacional'
      and not exists (
        select 1 from public.%1$I e
        where e.projeto_id = p.id and e.usuario_id = u.id
      )
  $sql$,
    v_link,
    case when v_tem_funcao then ', funcao' else '' end,
    case when v_tem_funcao then ', ''gestor_operacoes''' else '' end);

  -- 4c) Um montador por projeto, em rodízio entre os 6
  execute format($sql$
    insert into public.%1$I (projeto_id, usuario_id%2$s)
    select p.id, m.id%3$s
    from (
      select id, row_number() over (order by criado_em) as rn
      from public.projetos
    ) p
    join (
      select id, row_number() over (order by nome) as rn, count(*) over () as total
      from public.usuarios
      where perfil = 'montador' and nome = any($1)
    ) m
      on m.rn = 1 + (p.rn - 1) %% m.total
    where not exists (
      select 1 from public.%1$I e
      where e.projeto_id = p.id and e.usuario_id = m.id
    )
  $sql$,
    v_link,
    case when v_tem_funcao then ', funcao' else '' end,
    case when v_tem_funcao then ', ''montador''' else '' end)
  using v_montadores;
end $$;

-- ----------------------------------------------------------------------------
-- 5) Resumo final
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.projetos)                                             as total_projetos,
  (select count(*) from public.usuarios where perfil = 'gestor_comercial'   and ativo) as gestores_comerciais,
  (select count(*) from public.usuarios where perfil = 'gerente_operacional' and ativo) as gerentes_operacionais,
  (select count(*) from public.usuarios where perfil = 'diretor'            and ativo) as diretores,
  (select count(*) from public.usuarios where perfil = 'montador'           and ativo) as montadores;

-- Para conferir a distribuição por gestor, rode depois:
-- select responsavel_comercial as gestor, count(*) as projetos
-- from public.projetos
-- group by responsavel_comercial
-- order by gestor;
