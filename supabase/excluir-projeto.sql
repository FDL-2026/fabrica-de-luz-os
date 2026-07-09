-- ============================================================================
-- FÁBRICA DE LUZ — EXCLUSÃO DE PROJETO (apenas admin)
-- ============================================================================
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
-- Cria:
--   1. fdl_purge_dependentes  — helper que apaga, em cascata, tudo que
--      referencia um registro (descobre as FKs em tempo de execução).
--   2. fdl_excluir_projeto    — função chamada pelo app. Verifica que quem
--      chamou é admin ATIVO e então remove o projeto e suas dependências.
--
-- Segurança:
--   - fdl_excluir_projeto é SECURITY DEFINER e checa o perfil do chamador
--     (auth.uid() -> usuarios.perfil = 'admin').
--   - O helper NÃO é exposto: revogamos execute de anon/authenticated, então
--     só a função de exclusão (rodando como dona) consegue usá-lo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Helper recursivo de purga (interno)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_purge_dependentes(
  p_table regclass,
  p_ids uuid[],
  p_depth int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  fk          record;
  v_child_ids uuid[];
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    return;
  end if;

  if p_depth > 10 then
    raise exception 'Profundidade máxima de dependências excedida em %', p_table;
  end if;

  -- Para cada tabela filha que referencia p_table via FK...
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
    -- Evita auto-referência infinita
    if fk.child_table = p_table then
      continue;
    end if;

    begin
      -- Tabela filha tem coluna "id" (uuid): desce recursivamente
      execute format(
        'select coalesce(array_agg(id), ''{}''::uuid[]) from %s where %I = any($1)',
        fk.child_table, fk.child_col
      ) into v_child_ids using p_ids;

      perform public.fdl_purge_dependentes(fk.child_table, v_child_ids, p_depth + 1);
    exception when undefined_column then
      -- Tabela filha sem "id": apaga direto pelas chaves do pai
      execute format('delete from %s where %I = any($1)', fk.child_table, fk.child_col)
        using p_ids;
    end;
  end loop;

  -- Por fim, apaga os próprios registros
  execute format('delete from %s where id = any($1)', p_table) using p_ids;
end;
$fn$;

-- Não deixa ninguém chamar o helper diretamente
revoke all on function public.fdl_purge_dependentes(regclass, uuid[], int) from public;
revoke all on function public.fdl_purge_dependentes(regclass, uuid[], int) from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Função pública de exclusão (somente admin)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_excluir_projeto(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text;
  v_ativo  boolean;
  v_nome   text;
begin
  -- Quem está chamando?
  select perfil, ativo
    into v_perfil, v_ativo
  from public.usuarios
  where auth_user_id = auth.uid();

  if v_perfil is null then
    raise exception 'Sessão inválida. Faça login novamente.'
      using errcode = '42501';
  end if;

  if not coalesce(v_ativo, false) or v_perfil <> 'admin' then
    raise exception 'Apenas administradores podem excluir projetos.'
      using errcode = '42501';
  end if;

  -- Projeto existe?
  select coalesce(cliente, shopping, 'projeto')
    into v_nome
  from public.projetos
  where id = p_projeto_id;

  if v_nome is null then
    raise exception 'Projeto não encontrado.';
  end if;

  -- Apaga o projeto e tudo que depende dele
  perform public.fdl_purge_dependentes('public.projetos'::regclass, array[p_projeto_id], 0);

  return jsonb_build_object('ok', true, 'projeto_id', p_projeto_id, 'nome', v_nome);
end;
$$;

-- Só usuários autenticados podem chamar (a função por dentro exige admin)
revoke all on function public.fdl_excluir_projeto(uuid) from public, anon;
grant execute on function public.fdl_excluir_projeto(uuid) to authenticated;
