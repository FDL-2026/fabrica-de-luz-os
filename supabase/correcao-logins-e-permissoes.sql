-- ============================================================
-- CORREÇÃO DOS LOGINS DE TESTE + PERMISSÃO DE VALIDAÇÃO
-- Rode no SQL Editor do Supabase.
--
--   1. Conserta os logins criados manualmente (o Supabase Auth
--      exige string vazia — não NULL — em várias colunas de
--      token; sem isso o login falha com "Database error").
--   2. Regra de validação: admin, diretor e gerente operacional
--      validam qualquer OS; gestor comercial só valida OSs de
--      projetos sob sua responsabilidade (responsavel_comercial
--      igual ao seu nome).
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONSERTO DOS LOGINS (colunas de token não podem ser NULL)
-- ------------------------------------------------------------
update auth.users
   set confirmation_token        = coalesce(confirmation_token, ''),
       recovery_token            = coalesce(recovery_token, ''),
       email_change_token_new    = coalesce(email_change_token_new, ''),
       email_change_token_current= coalesce(email_change_token_current, ''),
       email_change              = coalesce(email_change, ''),
       phone_change              = coalesce(phone_change, ''),
       phone_change_token        = coalesce(phone_change_token, ''),
       reauthentication_token    = coalesce(reauthentication_token, '')
 where email like '%@fabricadeluz.com.br';

-- ------------------------------------------------------------
-- 2. PERMISSÃO DE VALIDAÇÃO POR RESPONSABILIDADE
-- ------------------------------------------------------------
create or replace function fdl_usuario_pode_validar_projeto(p_projeto_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario record;
begin
  select u.id, u.perfil, u.nome
    into v_usuario
    from usuarios u
   where u.auth_user_id = auth.uid()
     and u.ativo;

  if v_usuario is null then
    return false;
  end if;

  -- Admin, diretor e gerente operacional validam qualquer projeto
  if v_usuario.perfil in ('admin', 'diretor', 'gerente_operacional') then
    return true;
  end if;

  -- Gestor comercial: apenas projetos sob sua responsabilidade
  if v_usuario.perfil = 'gestor_comercial' then
    return exists (
      select 1
        from projetos p
       where p.id = p_projeto_id
         and lower(trim(coalesce(p.responsavel_comercial, ''))) =
             lower(trim(v_usuario.nome))
    );
  end if;

  return false;
end;
$$;

-- ------------------------------------------------------------
-- 3. CONFERÊNCIA
-- ------------------------------------------------------------
-- 3a. Logins prontos (todas as colunas de token preenchidas)
select u.nome, u.perfil, au.email,
       (au.encrypted_password is not null) as senha_ok,
       (au.confirmation_token = '') as token_ok
  from usuarios u
  join auth.users au on au.id = u.auth_user_id
 where u.tipo_login = 'email'
 order by u.perfil, u.nome;

-- 3b. Copie o resultado desta consulta e envie para o assistente:
--     é o código atual da função de validação, para fechar a
--     mesma regra também no ato de validar (não só na interface).
select pg_get_functiondef(oid)
  from pg_proc
 where proname = 'fdl_validar_os_gestao';
