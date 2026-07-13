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
