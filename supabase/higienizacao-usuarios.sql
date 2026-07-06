-- ============================================================
-- HIGIENIZAÇÃO DE USUÁRIOS + CRIAÇÃO DOS LOGINS DE TESTE
-- Rode no SQL Editor do Supabase.
--
--   1. Remove usuários duplicados (mesmo e-mail ou mesmo código
--      de acesso), preservando o mais antigo / o que já tem login
--      e reapontando os vínculos de projeto.
--   2. Cria o login real (Supabase Auth) para os usuários de
--      e-mail que ainda não têm, com a senha de teste Fdl@2026.
-- ============================================================

-- ------------------------------------------------------------
-- 1. REMOÇÃO DE DUPLICADOS
-- ------------------------------------------------------------
do $$
declare
  dup record;
begin
  -- Duplicados por e-mail e por código de acesso.
  -- Mantém: quem já tem auth_user_id; empate = o mais antigo.
  for dup in
    with chaves as (
      select id,
             auth_user_id,
             criado_em,
             coalesce(lower(nullif(trim(email), '')),
                      'cod:' || upper(nullif(trim(codigo_acesso), ''))) as chave
        from usuarios
    ),
    ranqueados as (
      select id,
             chave,
             row_number() over (
               partition by chave
               order by (auth_user_id is not null) desc, criado_em asc
             ) as posicao,
             first_value(id) over (
               partition by chave
               order by (auth_user_id is not null) desc, criado_em asc
             ) as manter_id
        from chaves
       where chave is not null
    )
    select id as remover_id, manter_id
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

    delete from usuarios where id = dup.remover_id;

    raise notice 'Removido duplicado % (mantido %)', dup.remover_id, dup.manter_id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. LOGINS DE TESTE (Supabase Auth) — senha: Fdl@2026
--    Apenas para usuários de e-mail ainda sem login.
-- ------------------------------------------------------------
do $$
declare
  u record;
  novo_auth_id uuid;
begin
  for u in
    select id, nome, lower(trim(email)) as email
      from usuarios
     where tipo_login = 'email'
       and auth_user_id is null
       and email is not null
  loop
    -- e-mail já existe no Auth? só conecta.
    select id into novo_auth_id from auth.users where email = u.email;

    if novo_auth_id is null then
      novo_auth_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        novo_auth_id,
        'authenticated',
        'authenticated',
        u.email,
        extensions.crypt('Fdl@2026', extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nome', u.nome),
        now(),
        now()
      );

      insert into auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        novo_auth_id,
        novo_auth_id::text,
        'email',
        jsonb_build_object('sub', novo_auth_id::text, 'email', u.email,
                           'email_verified', true),
        now(),
        now(),
        now()
      );
    end if;

    update usuarios set auth_user_id = novo_auth_id where id = u.id;

    raise notice 'Login criado/conectado para % (%)', u.nome, u.email;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. CONFERÊNCIA
-- ------------------------------------------------------------
select nome,
       perfil,
       coalesce(email, codigo_acesso) as acesso,
       tipo_login,
       ativo,
       (auth_user_id is not null) as tem_login
  from usuarios
 order by perfil, nome;
