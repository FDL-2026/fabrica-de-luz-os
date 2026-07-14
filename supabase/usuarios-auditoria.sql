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
