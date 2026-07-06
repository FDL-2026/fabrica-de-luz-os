-- ============================================================
-- LIMPEZA DE USUÁRIOS DUPLICADOS POR NOME
-- Rode no SQL Editor do Supabase.
--
-- Para cada NOME que aparece mais de uma vez, mantém o usuário
-- com e-mail @fabricadeluz.com.br (empate: o mais antigo) e
-- remove os demais — incluindo o login correspondente no Auth
-- e reapontando os vínculos de projeto para o usuário mantido.
-- ============================================================

do $$
declare
  dup record;
  v_auth uuid;
begin
  for dup in
    with ranqueados as (
      select id,
             nome,
             auth_user_id,
             row_number() over (
               partition by lower(trim(nome))
               order by
                 (lower(coalesce(email, '')) like '%@fabricadeluz.com.br') desc,
                 criado_em asc
             ) as posicao,
             first_value(id) over (
               partition by lower(trim(nome))
               order by
                 (lower(coalesce(email, '')) like '%@fabricadeluz.com.br') desc,
                 criado_em asc
             ) as manter_id
        from usuarios
    )
    select id as remover_id, manter_id, nome
      from ranqueados
     where posicao > 1
  loop
    -- reaponta vínculos de projeto para o usuário mantido
    insert into projeto_usuarios (projeto_id, usuario_id, funcao)
    select projeto_id, dup.manter_id, funcao
      from projeto_usuarios
     where usuario_id = dup.remover_id
    on conflict do nothing;

    delete from projeto_usuarios where usuario_id = dup.remover_id;

    -- guarda o auth vinculado antes de apagar o usuário
    select auth_user_id into v_auth from usuarios where id = dup.remover_id;

    delete from usuarios where id = dup.remover_id;

    -- remove o login órfão no Supabase Auth (identities caem em cascata)
    if v_auth is not null then
      delete from auth.users where id = v_auth;
    end if;

    raise notice 'Removido duplicado de "%" (mantido %)', dup.nome, dup.manter_id;
  end loop;
end $$;

-- Conferência: deve sobrar um usuário por nome
select nome,
       perfil,
       coalesce(email, codigo_acesso) as acesso,
       (auth_user_id is not null) as tem_login
  from usuarios
 order by perfil, nome;
