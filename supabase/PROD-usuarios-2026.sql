-- ============================================================
-- PRODUÇÃO — Usuários: perfis, senha provisória e auditoria
-- Rode TUDO de uma vez no SQL Editor do Supabase (produção).
-- Ordem já organizada. Idempotente (pode rodar novamente).
-- ============================================================

-- >>> 1) PERFIS COMERCIAL OPERACIONAL + VÍNCULO COM GESTOR
-- ============================================================
-- PERFIS COMERCIAL OPERACIONAL + VÍNCULO COM GESTOR (Fase A)
-- Rode no SQL Editor do Supabase.
--
-- Adiciona os perfis Analista, Assistente, Estagiário e Auxiliar
-- (todos vinculados a um gestor, herdando o acesso dele) e o perfil
-- Visitante (somente leitura). Renomeia apenas os RÓTULOS de gerente/
-- gestor na aplicação — os valores internos continuam iguais.
-- ============================================================

-- ------------------------------------------------------------
-- 1) CHECK de perfil: passa a aceitar os novos valores
-- ------------------------------------------------------------
alter table public.usuarios
  drop constraint if exists usuarios_perfil_check;

alter table public.usuarios
  add constraint usuarios_perfil_check
  check (perfil = any (array[
    'admin', 'diretor', 'gerente_operacional', 'gestor_comercial',
    'analista', 'assistente', 'estagiario', 'auxiliar',
    'montador', 'visitante'
  ]::text[]));

-- ------------------------------------------------------------
-- 2) Vínculo com o gestor (analista/assistente/estagiário/auxiliar)
-- ------------------------------------------------------------
alter table public.usuarios
  add column if not exists gestor_id uuid
  references public.usuarios(id) on delete set null;

create index if not exists idx_usuarios_gestor_id
  on public.usuarios(gestor_id);

-- ------------------------------------------------------------
-- 3) Ator dos chamados — vinculados assumem o NOME do gestor para
--    fins de escopo (responsavel_comercial). O usuario_id continua
--    sendo o do próprio usuário (atribuições/histórico).
-- ------------------------------------------------------------
create or replace function public.fdl_chamado_ator()
returns table (usuario_id uuid, nome text, perfil text, ativo boolean)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    case
      when u.perfil in ('analista', 'assistente', 'estagiario', 'auxiliar')
        then coalesce(g.nome, u.nome)
      else u.nome
    end::text,
    u.perfil::text,
    coalesce(u.ativo, true)
  from public.usuarios u
  left join public.usuarios g on g.id = u.gestor_id
  where u.auth_user_id = auth.uid()
$$;
revoke all on function public.fdl_chamado_ator() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4) Ator dos relatórios — mesma herança de nome para o escopo
-- ------------------------------------------------------------
create or replace function public.fdl_rel_ator()
returns table (nome text, perfil text, todos boolean)
language sql
security definer
set search_path = public
as $$
  select
    case
      when u.perfil in ('analista', 'assistente', 'estagiario', 'auxiliar')
        then coalesce(g.nome, u.nome)
      else u.nome
    end::text,
    u.perfil::text,
    (u.perfil in ('admin', 'diretor', 'gerente_operacional')) as todos
  from public.usuarios u
  left join public.usuarios g on g.id = u.gestor_id
  where u.auth_user_id = auth.uid() and coalesce(u.ativo, true)
$$;
revoke all on function public.fdl_rel_ator() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5) Permissão de validação — vinculados validam os projetos do
--    gestor; visitante e montador não validam.
-- ------------------------------------------------------------
create or replace function public.fdl_usuario_pode_validar_projeto(p_projeto_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil      text;
  v_nome_escopo text;
begin
  select
    u.perfil,
    case
      when u.perfil in ('analista', 'assistente', 'estagiario', 'auxiliar')
        then coalesce(g.nome, u.nome)
      else u.nome
    end
  into v_perfil, v_nome_escopo
  from public.usuarios u
  left join public.usuarios g on g.id = u.gestor_id
  where u.auth_user_id = auth.uid() and u.ativo;

  if v_perfil is null then
    return false;
  end if;

  -- Acesso total
  if v_perfil in ('admin', 'diretor', 'gerente_operacional') then
    return true;
  end if;

  -- Gestor e vinculados: apenas projetos sob responsabilidade do gestor
  if v_perfil in ('gestor_comercial', 'analista', 'assistente', 'estagiario', 'auxiliar') then
    return exists (
      select 1
        from public.projetos p
       where p.id = p_projeto_id
         and lower(trim(coalesce(p.responsavel_comercial, ''))) =
             lower(trim(coalesce(v_nome_escopo, '')))
    );
  end if;

  -- montador, visitante
  return false;
end;
$$;

-- ------------------------------------------------------------
-- 6) Listagem de usuários da gestão — inclui o gestor vinculado no
--    retorno e amplia quem pode listar:
--      • acesso total: todos os usuários
--      • gestor: montadores + seus próprios vinculados
--      • vinculados: montadores
-- ------------------------------------------------------------
drop function if exists public.fdl_listar_usuarios_gestao();

create function public.fdl_listar_usuarios_gestao()
returns table (
  usuario_id        uuid,
  nome              text,
  email             text,
  perfil            text,
  ativo             boolean,
  tipo_login        text,
  codigo_acesso     text,
  gestor_id         uuid,
  gestor_nome       text,
  ultimo_acesso_pin timestamptz,
  criado_em         timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_perfil text;
begin
  select u.id, u.perfil::text
  into v_id, v_perfil
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and coalesce(u.ativo, true) is true
  limit 1;

  if v_perfil not in (
    'admin', 'diretor', 'gerente_operacional', 'gestor_comercial',
    'analista', 'assistente', 'estagiario', 'auxiliar'
  ) then
    return;
  end if;

  return query
  select
    u.id,
    u.nome::text,
    u.email::text,
    u.perfil::text,
    coalesce(u.ativo, true),
    coalesce(u.tipo_login, 'email')::text,
    u.codigo_acesso::text,
    u.gestor_id,
    g.nome::text,
    u.ultimo_acesso_pin,
    u.criado_em
  from public.usuarios u
  left join public.usuarios g on g.id = u.gestor_id
  where (
    v_perfil in ('admin', 'diretor', 'gerente_operacional')
    or (
      v_perfil = 'gestor_comercial'
      and (
        u.perfil = 'montador'
        or (
          u.perfil in ('analista', 'assistente', 'estagiario', 'auxiliar')
          and u.gestor_id = v_id
        )
      )
    )
    or (
      v_perfil in ('analista', 'assistente', 'estagiario', 'auxiliar')
      and u.perfil = 'montador'
    )
  )
  order by
    coalesce(u.ativo, true) desc,
    u.nome;
end;
$$;

revoke all on function public.fdl_listar_usuarios_gestao() from public, anon;
grant execute on function public.fdl_listar_usuarios_gestao() to authenticated;

-- ------------------------------------------------------------
-- 7) CONFERÊNCIA (opcional)
-- ------------------------------------------------------------
-- select id, nome, perfil, gestor_id from public.usuarios order by perfil, nome;

-- >>> 2) SENHA PROVISÓRIA (troca no 1º login)
-- ============================================================
-- SENHA PROVISÓRIA — trocar senha no primeiro login
-- Rode no SQL Editor do Supabase.
--
-- Marca usuários criados com senha padrão para que, ao logar,
-- sejam obrigados a definir uma nova senha antes de usar o sistema.
-- Só se aplica a acessos por e-mail (montadores usam Código + PIN).
-- ============================================================

alter table public.usuarios
  add column if not exists senha_provisoria boolean not null default false;

-- Observação: usuários já existentes ficam com false (não são forçados a
-- trocar). Novos cadastros por e-mail passam a receber true pela aplicação.

-- >>> 3) AUDITORIA DE USUÁRIOS + EXCLUSÃO
-- ============================================================
-- AUDITORIA DE USUÁRIOS + EXCLUSÃO
-- Rode no SQL Editor do Supabase.
--
-- Registra quem criou, alterou, ativou/inativou ou excluiu cada
-- usuário. A tabela NÃO tem FK para usuarios, para que o histórico
-- sobreviva à exclusão do usuário. Só o perfil admin lê o histórico.
-- ============================================================

create table if not exists public.usuarios_auditoria (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid,
  usuario_nome  text,
  usuario_email text,
  acao          text not null,   -- criado | alterado | ativado | inativado | excluido
  detalhes      text,
  autor_id      uuid,
  autor_nome    text,
  autor_perfil  text,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_usuarios_auditoria_usuario
  on public.usuarios_auditoria(usuario_id);
create index if not exists idx_usuarios_auditoria_criado_em
  on public.usuarios_auditoria(criado_em desc);

alter table public.usuarios_auditoria enable row level security;
-- Sem policies: leitura/escrita só via service role (rotas admin) e via a
-- função abaixo (security definer). Nenhum acesso direto do cliente.

-- ------------------------------------------------------------
-- Histórico (somente admin)
-- ------------------------------------------------------------
create or replace function public.fdl_listar_auditoria_usuarios(
  p_usuario_id uuid default null
)
returns table (
  id            uuid,
  usuario_id    uuid,
  usuario_nome  text,
  usuario_email text,
  acao          text,
  detalhes      text,
  autor_nome    text,
  autor_perfil  text,
  criado_em     timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text;
begin
  select u.perfil::text
  into v_perfil
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and coalesce(u.ativo, true) is true
  limit 1;

  if v_perfil is distinct from 'admin' then
    return;
  end if;

  return query
  select
    a.id,
    a.usuario_id,
    a.usuario_nome,
    a.usuario_email,
    a.acao,
    a.detalhes,
    a.autor_nome,
    a.autor_perfil,
    a.criado_em
  from public.usuarios_auditoria a
  where (p_usuario_id is null or a.usuario_id = p_usuario_id)
  order by a.criado_em desc
  limit 500;
end;
$$;

revoke all on function public.fdl_listar_auditoria_usuarios(uuid) from public, anon;
grant execute on function public.fdl_listar_auditoria_usuarios(uuid) to authenticated;
