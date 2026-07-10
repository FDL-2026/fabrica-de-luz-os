-- ============================================================================
-- FÁBRICA DE LUZ — CHAMADOS DE MANUTENÇÃO
-- ============================================================================
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
--
-- Cria a estrutura para o cliente registrar solicitações de manutenção por um
-- link público (sem login), identificando o projeto. Cada chamado cai
-- automaticamente para o gestor responsável pelo projeto.
--
-- Cria:
--   Tabelas:  chamados, chamado_anexos, chamado_eventos
--   Públicas (anon):  fdl_buscar_projetos_chamado, fdl_criar_chamado,
--                     fdl_obter_contexto_chamado, fdl_registrar_anexo_chamado
--   Gestão (authenticated, escopado por perfil):
--                     fdl_resumo_chamados_gestao, fdl_listar_chamados_gestao,
--                     fdl_obter_chamado_gestao, fdl_atualizar_chamado_gestao
--
-- Segurança:
--   - Tabelas com RLS habilitado e SEM políticas: acesso só pelas RPCs
--     (SECURITY DEFINER). Nenhum acesso direto por anon/authenticated.
--   - As RPCs de gestão checam auth.uid() -> usuarios (perfil/ativo). Gestor
--     comercial vê apenas chamados dos seus projetos; gerente/diretor/admin
--     veem todos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Tabelas
-- ----------------------------------------------------------------------------
create table if not exists public.chamados (
  id                    uuid primary key default gen_random_uuid(),
  protocolo             text unique not null,
  projeto_id            uuid not null references public.projetos(id) on delete cascade,
  responsavel_comercial text,               -- snapshot do gestor no momento do registro
  solicitante_nome      text,
  solicitante_contato   text,
  categoria             text not null default 'manutencao',
  prioridade            text not null default 'media',
  local_ponto           text,
  titulo                text,
  descricao             text not null,
  status                text not null default 'aberto',
  atribuido_usuario_id  uuid references public.usuarios(id) on delete set null,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  resolvido_em          timestamptz
);

create index if not exists chamados_projeto_idx on public.chamados (projeto_id);
create index if not exists chamados_status_idx  on public.chamados (status);
create index if not exists chamados_gestor_idx  on public.chamados (responsavel_comercial);

create table if not exists public.chamado_anexos (
  id                 uuid primary key default gen_random_uuid(),
  chamado_id         uuid not null references public.chamados(id) on delete cascade,
  tipo               text not null default 'foto',
  nome_arquivo       text,
  mime_type          text,
  tamanho_bytes      bigint,
  provider           text default 'google_drive',
  external_file_id   text,
  external_folder_id text,
  url_visualizacao   text,
  caminho_arquivo    text,
  criado_em          timestamptz not null default now()
);

create index if not exists chamado_anexos_chamado_idx on public.chamado_anexos (chamado_id);

create table if not exists public.chamado_eventos (
  id          uuid primary key default gen_random_uuid(),
  chamado_id  uuid not null references public.chamados(id) on delete cascade,
  tipo        text not null,          -- criado | status | atribuicao | observacao
  de_status   text,
  para_status text,
  descricao   text,
  usuario_id  uuid references public.usuarios(id) on delete set null,
  usuario_nome text,
  criado_em   timestamptz not null default now()
);

create index if not exists chamado_eventos_chamado_idx on public.chamado_eventos (chamado_id);

-- Sequência para o número do protocolo (CH-<ano>-<seq>)
create sequence if not exists public.chamados_protocolo_seq;

-- RLS: liga e não cria políticas -> acesso somente via RPCs SECURITY DEFINER
alter table public.chamados        enable row level security;
alter table public.chamado_anexos  enable row level security;
alter table public.chamado_eventos enable row level security;

revoke all on public.chamados,        public.chamado_anexos, public.chamado_eventos from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1) Helper interno: identifica o chamador na tabela usuarios
-- ----------------------------------------------------------------------------
create or replace function public.fdl_chamado_ator()
returns table (usuario_id uuid, nome text, perfil text, ativo boolean)
language sql
security definer
set search_path = public
as $$
  select id, nome, perfil, ativo
  from public.usuarios
  where auth_user_id = auth.uid()
$$;

revoke all on function public.fdl_chamado_ator() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) PÚBLICO — busca de projetos para o autocomplete do formulário
-- ----------------------------------------------------------------------------
-- Retorna campos mínimos (sem gestor/dados sensíveis). Exige >= 2 caracteres.
create or replace function public.fdl_buscar_projetos_chamado(p_busca text)
returns table (
  projeto_id uuid,
  cliente    text,
  shopping   text,
  cidade     text,
  uf         text,
  temporada  text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.cliente, p.shopping, p.cidade, p.uf, p.temporada
  from public.projetos p
  where char_length(coalesce(trim(p_busca), '')) >= 2
    and (
      p.shopping ilike '%' || trim(p_busca) || '%'
      or p.cliente ilike '%' || trim(p_busca) || '%'
      or p.cidade  ilike '%' || trim(p_busca) || '%'
    )
  order by coalesce(p.shopping, p.cliente) asc
  limit 10
$$;

revoke all on function public.fdl_buscar_projetos_chamado(text) from public;
grant execute on function public.fdl_buscar_projetos_chamado(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) PÚBLICO — cria o chamado
-- ----------------------------------------------------------------------------
create or replace function public.fdl_criar_chamado(
  p_projeto_id          uuid,
  p_solicitante_nome    text,
  p_solicitante_contato text,
  p_categoria           text,
  p_prioridade          text,
  p_local_ponto         text,
  p_titulo              text,
  p_descricao           text
)
returns table (chamado_id uuid, protocolo text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gestor    text;
  v_protocolo text;
  v_id        uuid;
begin
  -- Projeto precisa existir
  select responsavel_comercial into v_gestor
  from public.projetos where id = p_projeto_id;

  if not found then
    raise exception 'Projeto não encontrado. Selecione um projeto da lista.';
  end if;

  if char_length(coalesce(trim(p_descricao), '')) < 5 then
    raise exception 'Descreva o problema com um pouco mais de detalhe.';
  end if;

  v_protocolo := 'CH-' || to_char(now(), 'YYYY') || '-' ||
                 lpad(nextval('public.chamados_protocolo_seq')::text, 4, '0');

  insert into public.chamados (
    protocolo, projeto_id, responsavel_comercial,
    solicitante_nome, solicitante_contato,
    categoria, prioridade, local_ponto, titulo, descricao
  ) values (
    v_protocolo, p_projeto_id, v_gestor,
    nullif(trim(p_solicitante_nome), ''), nullif(trim(p_solicitante_contato), ''),
    coalesce(nullif(trim(p_categoria), ''), 'manutencao'),
    coalesce(nullif(trim(p_prioridade), ''), 'media'),
    nullif(trim(p_local_ponto), ''), nullif(trim(p_titulo), ''),
    trim(p_descricao)
  )
  returning id into v_id;

  insert into public.chamado_eventos (chamado_id, tipo, para_status, descricao, usuario_nome)
  values (v_id, 'criado', 'aberto', 'Chamado registrado pelo cliente.',
          nullif(trim(p_solicitante_nome), ''));

  return query select v_id, v_protocolo;
end;
$$;

revoke all on function public.fdl_criar_chamado(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.fdl_criar_chamado(uuid, text, text, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) PÚBLICO — contexto do chamado (para a rota de upload montar as pastas)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_obter_contexto_chamado(p_chamado_id uuid)
returns table (
  chamado_id uuid,
  protocolo  text,
  projeto_id uuid,
  cliente    text,
  shopping   text,
  uf         text,
  temporada  text
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.protocolo, p.id, p.cliente, p.shopping, p.uf, p.temporada
  from public.chamados c
  join public.projetos p on p.id = c.projeto_id
  where c.id = p_chamado_id
$$;

revoke all on function public.fdl_obter_contexto_chamado(uuid) from public;
grant execute on function public.fdl_obter_contexto_chamado(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) PÚBLICO — registra o anexo enviado ao Drive
-- ----------------------------------------------------------------------------
create or replace function public.fdl_registrar_anexo_chamado(
  p_chamado_id         uuid,
  p_tipo               text,
  p_nome_arquivo       text,
  p_mime_type          text,
  p_tamanho_bytes      bigint,
  p_provider           text,
  p_external_file_id   text,
  p_external_folder_id text,
  p_url_visualizacao   text,
  p_caminho_arquivo    text
)
returns table (anexo_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.chamados where id = p_chamado_id) then
    raise exception 'Chamado não encontrado.';
  end if;

  insert into public.chamado_anexos (
    chamado_id, tipo, nome_arquivo, mime_type, tamanho_bytes,
    provider, external_file_id, external_folder_id, url_visualizacao, caminho_arquivo
  ) values (
    p_chamado_id, coalesce(nullif(trim(p_tipo), ''), 'foto'),
    p_nome_arquivo, p_mime_type, p_tamanho_bytes,
    coalesce(nullif(trim(p_provider), ''), 'google_drive'),
    p_external_file_id, p_external_folder_id, p_url_visualizacao, p_caminho_arquivo
  )
  returning id into v_id;

  return query select v_id;
end;
$$;

revoke all on function public.fdl_registrar_anexo_chamado(uuid, text, text, text, bigint, text, text, text, text, text) from public;
grant execute on function public.fdl_registrar_anexo_chamado(uuid, text, text, text, bigint, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) GESTÃO — quais chamados o chamador pode ver (predicado reutilizável)
-- ----------------------------------------------------------------------------
-- Perfis com visão total; demais gestores só enxergam os próprios projetos.
-- (gestor_comercial: casamento por nome com projetos.responsavel_comercial)

-- Resumo para o KPI do dashboard
create or replace function public.fdl_resumo_chamados_gestao()
returns table (
  abertos       bigint,
  em_andamento  bigint,
  aguardando    bigint,
  resolvidos    bigint,
  total         bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome   text;
  v_perfil text;
  v_ativo  boolean;
  v_todos  boolean;
begin
  select nome, perfil, ativo into v_nome, v_perfil, v_ativo from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  return query
  select
    count(*) filter (where status = 'aberto'),
    count(*) filter (where status = 'em_andamento'),
    count(*) filter (where status = 'aguardando_peca'),
    count(*) filter (where status = 'resolvido'),
    count(*)
  from public.chamados c
  where v_todos or c.responsavel_comercial = v_nome;
end;
$$;

revoke all on function public.fdl_resumo_chamados_gestao() from public, anon;
grant execute on function public.fdl_resumo_chamados_gestao() to authenticated;

-- Lista de chamados
create or replace function public.fdl_listar_chamados_gestao(
  p_status     text default null,
  p_projeto_id uuid default null
)
returns table (
  chamado_id            uuid,
  protocolo             text,
  projeto_id            uuid,
  cliente               text,
  shopping              text,
  uf                    text,
  temporada             text,
  responsavel_comercial text,
  solicitante_nome      text,
  solicitante_contato   text,
  categoria             text,
  prioridade            text,
  local_ponto           text,
  titulo                text,
  descricao             text,
  status                text,
  atribuido_usuario_id  uuid,
  atribuido_nome        text,
  total_anexos          bigint,
  criado_em             timestamptz,
  atualizado_em         timestamptz,
  resolvido_em          timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome   text;
  v_perfil text;
  v_ativo  boolean;
  v_todos  boolean;
begin
  select nome, perfil, ativo into v_nome, v_perfil, v_ativo from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  return query
  select
    c.id, c.protocolo, p.id, p.cliente, p.shopping, p.uf, p.temporada,
    c.responsavel_comercial, c.solicitante_nome, c.solicitante_contato,
    c.categoria, c.prioridade, c.local_ponto, c.titulo, c.descricao, c.status,
    c.atribuido_usuario_id, u.nome,
    (select count(*) from public.chamado_anexos a where a.chamado_id = c.id),
    c.criado_em, c.atualizado_em, c.resolvido_em
  from public.chamados c
  join public.projetos p on p.id = c.projeto_id
  left join public.usuarios u on u.id = c.atribuido_usuario_id
  where (v_todos or c.responsavel_comercial = v_nome)
    and (p_status is null or c.status = p_status)
    and (p_projeto_id is null or c.projeto_id = p_projeto_id)
  order by
    case c.status when 'aberto' then 0 when 'em_andamento' then 1
                  when 'aguardando_peca' then 2 when 'resolvido' then 3 else 4 end,
    case c.prioridade when 'urgente' then 0 when 'alta' then 1
                      when 'media' then 2 else 3 end,
    c.criado_em desc;
end;
$$;

revoke all on function public.fdl_listar_chamados_gestao(text, uuid) from public, anon;
grant execute on function public.fdl_listar_chamados_gestao(text, uuid) to authenticated;

-- Detalhe de um chamado (com anexos e histórico), respeitando o escopo
create or replace function public.fdl_obter_chamado_gestao(p_chamado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome   text;
  v_perfil text;
  v_ativo  boolean;
  v_todos  boolean;
  v_result jsonb;
begin
  select nome, perfil, ativo into v_nome, v_perfil, v_ativo from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  select jsonb_build_object(
    'chamado', to_jsonb(c) || jsonb_build_object(
        'cliente', p.cliente, 'shopping', p.shopping, 'uf', p.uf,
        'temporada', p.temporada, 'atribuido_nome', u.nome),
    'anexos', coalesce((
       select jsonb_agg(to_jsonb(a) order by a.criado_em)
       from public.chamado_anexos a where a.chamado_id = c.id), '[]'::jsonb),
    'eventos', coalesce((
       select jsonb_agg(to_jsonb(e) order by e.criado_em desc)
       from public.chamado_eventos e where e.chamado_id = c.id), '[]'::jsonb)
  )
  into v_result
  from public.chamados c
  join public.projetos p on p.id = c.projeto_id
  left join public.usuarios u on u.id = c.atribuido_usuario_id
  where c.id = p_chamado_id
    and (v_todos or c.responsavel_comercial = v_nome);

  if v_result is null then
    raise exception 'Chamado não encontrado ou fora do seu escopo.';
  end if;

  return v_result;
end;
$$;

revoke all on function public.fdl_obter_chamado_gestao(uuid) from public, anon;
grant execute on function public.fdl_obter_chamado_gestao(uuid) to authenticated;

-- Lista de montadores ativos, para atribuir um chamado
create or replace function public.fdl_listar_montadores_chamado()
returns table (usuario_id uuid, nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text;
  v_ativo  boolean;
begin
  select perfil, ativo into v_perfil, v_ativo from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  return query
  select id, nome from public.usuarios
  where perfil = 'montador' and coalesce(ativo, true)
  order by nome;
end;
$$;

revoke all on function public.fdl_listar_montadores_chamado() from public, anon;
grant execute on function public.fdl_listar_montadores_chamado() to authenticated;

-- Atualiza status / atribuição / observação, registrando no histórico
create or replace function public.fdl_atualizar_chamado_gestao(
  p_chamado_id          uuid,
  p_status              text default null,
  p_atribuido_usuario_id uuid default null,
  p_observacao          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_nome   text;
  v_perfil text;
  v_ativo  boolean;
  v_todos  boolean;
  v_atual  public.chamados%rowtype;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  select * into v_atual from public.chamados
  where id = p_chamado_id and (v_todos or responsavel_comercial = v_nome);
  if not found then
    raise exception 'Chamado não encontrado ou fora do seu escopo.';
  end if;

  -- Mudança de status
  if p_status is not null and p_status <> v_atual.status then
    update public.chamados
      set status = p_status,
          resolvido_em = case when p_status = 'resolvido' then now()
                              when p_status <> 'resolvido' then null
                              else resolvido_em end,
          atualizado_em = now()
      where id = p_chamado_id;

    insert into public.chamado_eventos (chamado_id, tipo, de_status, para_status, usuario_id, usuario_nome)
    values (p_chamado_id, 'status', v_atual.status, p_status, v_uid, v_nome);
  end if;

  -- Atribuição
  if p_atribuido_usuario_id is not null
     and p_atribuido_usuario_id is distinct from v_atual.atribuido_usuario_id then
    update public.chamados
      set atribuido_usuario_id = p_atribuido_usuario_id, atualizado_em = now()
      where id = p_chamado_id;

    insert into public.chamado_eventos (chamado_id, tipo, descricao, usuario_id, usuario_nome)
    values (p_chamado_id, 'atribuicao',
            (select 'Atribuído a ' || nome from public.usuarios where id = p_atribuido_usuario_id),
            v_uid, v_nome);
  end if;

  -- Observação livre
  if char_length(coalesce(trim(p_observacao), '')) > 0 then
    update public.chamados set atualizado_em = now() where id = p_chamado_id;
    insert into public.chamado_eventos (chamado_id, tipo, descricao, usuario_id, usuario_nome)
    values (p_chamado_id, 'observacao', trim(p_observacao), v_uid, v_nome);
  end if;

  return public.fdl_obter_chamado_gestao(p_chamado_id);
end;
$$;

revoke all on function public.fdl_atualizar_chamado_gestao(uuid, text, uuid, text) from public, anon;
grant execute on function public.fdl_atualizar_chamado_gestao(uuid, text, uuid, text) to authenticated;
