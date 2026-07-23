-- ============================================================
-- MANUTENÇÕES PROATIVAS (registro pela equipe, visível ao cliente)
-- Rode no SQL Editor do Supabase (teste na preview antes da produção).
--
-- Diferente do CHAMADO (que o cliente abre), a MANUTENÇÃO é um reparo que a
-- própria equipe fez e registra na hora, com fotos antes/depois geo-carimbadas.
-- Fica visível IMEDIATAMENTE no link público do shopping (/chamado/<token>) e
-- o gestor é avisado por card + lista.
--
-- Registro por DOIS atores, com a mesma RPC:
--   - Montador (login por PIN, sem sessão): passa p_usuario_id; autoriza pelo
--     vínculo montador↔projeto (projeto_usuarios).
--   - Gestão (login por e-mail): p_usuario_id nulo; usa auth.uid(); perfis de
--     visão total podem tudo, os demais precisam de vínculo com o projeto.
-- ============================================================

create table if not exists public.manutencoes (
  id                  uuid primary key default gen_random_uuid(),
  projeto_id          uuid not null references public.projetos(id) on delete cascade,
  etapa_id            uuid references public.etapas_projeto(id) on delete set null, -- mundo
  local_ponto         text,
  descricao           text not null,
  registrado_por      uuid references public.usuarios(id) on delete set null,
  registrado_por_nome text,
  criado_em           timestamptz not null default now()
);

create index if not exists manutencoes_projeto_idx on public.manutencoes (projeto_id);
create index if not exists manutencoes_criado_idx  on public.manutencoes (criado_em desc);

create table if not exists public.manutencao_anexos (
  id                 uuid primary key default gen_random_uuid(),
  manutencao_id      uuid not null references public.manutencoes(id) on delete cascade,
  fase               text,                       -- 'antes' | 'depois'
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

create index if not exists manutencao_anexos_idx on public.manutencao_anexos (manutencao_id);

alter table public.manutencoes      enable row level security;
alter table public.manutencao_anexos enable row level security;
revoke all on public.manutencoes, public.manutencao_anexos from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Helper: identifica o ator e valida acesso ao projeto (montador ou gestão).
-- Devolve (usuario_id, nome). Levanta exceção se não puder registrar.
-- ----------------------------------------------------------------------------
create or replace function public.fdl_ator_manutencao(
  p_projeto_id uuid,
  p_usuario_id uuid
)
returns table (usuario_id uuid, nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_nome   text;
  v_perfil text;
  v_ativo  boolean;
begin
  if p_usuario_id is not null then
    -- Montador/vinculado por PIN: confia no usuario_id + exige vínculo sempre.
    select u.id, u.nome, u.perfil, u.ativo
      into v_uid, v_nome, v_perfil, v_ativo
    from public.usuarios u where u.id = p_usuario_id;

    if v_uid is null or not coalesce(v_ativo, false) or v_perfil = 'visitante' then
      raise exception 'Sem permissão para registrar manutenção.' using errcode = '42501';
    end if;

    if not exists (
      select 1 from public.projeto_usuarios pu
      where pu.projeto_id = p_projeto_id and pu.usuario_id = v_uid
    ) then
      raise exception 'Sem vínculo com este projeto.' using errcode = '42501';
    end if;
  else
    -- Gestão autenticada.
    select a.usuario_id, a.nome, a.perfil, a.ativo
      into v_uid, v_nome, v_perfil, v_ativo
    from public.fdl_chamado_ator() a;

    if v_uid is null or not coalesce(v_ativo, false) or v_perfil = 'visitante' then
      raise exception 'Sessão inválida ou sem permissão.' using errcode = '42501';
    end if;

    -- Visão total pode tudo; os demais precisam de vínculo com o projeto.
    if v_perfil not in ('admin', 'diretor', 'gerente_operacional')
       and not exists (
         select 1 from public.projeto_usuarios pu
         where pu.projeto_id = p_projeto_id and pu.usuario_id = v_uid
       ) then
      raise exception 'Sem acesso a este projeto.' using errcode = '42501';
    end if;
  end if;

  return query select v_uid, v_nome;
end;
$$;

revoke all on function public.fdl_ator_manutencao(uuid, uuid) from public;
grant execute on function public.fdl_ator_manutencao(uuid, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Registrar manutenção
-- ----------------------------------------------------------------------------
create or replace function public.fdl_registrar_manutencao(
  p_projeto_id uuid,
  p_etapa_id   uuid,
  p_local      text,
  p_descricao  text,
  p_usuario_id uuid default null
)
returns table (manutencao_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_nome text;
  v_id   uuid;
begin
  if p_descricao is null or length(trim(p_descricao)) = 0 then
    raise exception 'Descreva o que foi feito.';
  end if;

  select usuario_id, nome into v_uid, v_nome
  from public.fdl_ator_manutencao(p_projeto_id, p_usuario_id);

  insert into public.manutencoes (
    projeto_id, etapa_id, local_ponto, descricao, registrado_por, registrado_por_nome
  ) values (
    p_projeto_id,
    p_etapa_id,
    nullif(trim(p_local), ''),
    trim(p_descricao),
    v_uid,
    v_nome
  )
  returning id into v_id;

  return query select v_id;
end;
$$;

revoke all on function public.fdl_registrar_manutencao(uuid, uuid, text, text, uuid) from public;
grant execute on function public.fdl_registrar_manutencao(uuid, uuid, text, text, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Registrar anexo (foto) da manutenção — mesma autorização
-- ----------------------------------------------------------------------------
create or replace function public.fdl_registrar_anexo_manutencao(
  p_manutencao_id    uuid,
  p_fase             text,
  p_tipo             text,
  p_nome_arquivo     text,
  p_mime_type        text,
  p_tamanho_bytes    bigint,
  p_provider         text,
  p_external_file_id text,
  p_external_folder_id text,
  p_url_visualizacao text,
  p_caminho_arquivo  text,
  p_usuario_id       uuid default null
)
returns table (anexo_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projeto uuid;
  v_id      uuid;
begin
  select projeto_id into v_projeto
  from public.manutencoes where id = p_manutencao_id;

  if v_projeto is null then
    raise exception 'Manutenção não encontrada.';
  end if;

  -- Reaproveita a mesma checagem de acesso ao projeto.
  perform public.fdl_ator_manutencao(v_projeto, p_usuario_id);

  insert into public.manutencao_anexos (
    manutencao_id, fase, tipo, nome_arquivo, mime_type, tamanho_bytes,
    provider, external_file_id, external_folder_id, url_visualizacao, caminho_arquivo
  ) values (
    p_manutencao_id,
    case when nullif(trim(p_fase), '') in ('antes', 'depois') then trim(p_fase) else null end,
    coalesce(nullif(trim(p_tipo), ''), 'foto'),
    p_nome_arquivo, p_mime_type, p_tamanho_bytes,
    coalesce(nullif(trim(p_provider), ''), 'google_drive'),
    p_external_file_id, p_external_folder_id, p_url_visualizacao, p_caminho_arquivo
  )
  returning id into v_id;

  return query select v_id;
end;
$$;

revoke all on function public.fdl_registrar_anexo_manutencao(uuid, text, text, text, text, bigint, text, text, text, text, text, uuid) from public;
grant execute on function public.fdl_registrar_anexo_manutencao(uuid, text, text, text, text, bigint, text, text, text, text, text, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Contexto do projeto (para a rota de upload montar a pasta no Drive e
-- autorizar o ator). Serve montador (p_usuario_id) e gestão (auth).
-- ----------------------------------------------------------------------------
create or replace function public.fdl_contexto_manutencao(
  p_manutencao_id uuid,
  p_usuario_id    uuid default null
)
returns table (projeto_id uuid, cliente text, shopping text, uf text, temporada text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projeto uuid;
begin
  select projeto_id into v_projeto
  from public.manutencoes where id = p_manutencao_id;

  if v_projeto is null then
    raise exception 'Manutenção não encontrada.';
  end if;

  perform public.fdl_ator_manutencao(v_projeto, p_usuario_id);

  return query
  select p.id, p.cliente::text, p.shopping::text, p.uf::text, p.temporada::text
  from public.projetos p where p.id = v_projeto;
end;
$$;

revoke all on function public.fdl_contexto_manutencao(uuid, uuid) from public;
grant execute on function public.fdl_contexto_manutencao(uuid, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — resumo (card do dashboard), lista e detalhe
-- Escopo: visão total vê tudo; demais veem manutenções dos projetos onde têm
-- vínculo ou são responsáveis (responsavel_comercial).
-- ----------------------------------------------------------------------------
create or replace function public.fdl_resumo_manutencoes_gestao()
returns table (recentes bigint, total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; v_perfil text; v_ativo boolean; v_uid uuid; v_todos boolean;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  return query
  select
    count(*) filter (where m.criado_em >= now() - interval '7 days'),
    count(*)
  from public.manutencoes m
  join public.projetos p on p.id = m.projeto_id
  where v_todos
     or p.responsavel_comercial = v_nome
     or exists (
       select 1 from public.projeto_usuarios pu
       where pu.projeto_id = m.projeto_id and pu.usuario_id = v_uid
     );
end;
$$;

revoke all on function public.fdl_resumo_manutencoes_gestao() from public, anon;
grant execute on function public.fdl_resumo_manutencoes_gestao() to authenticated;

create or replace function public.fdl_listar_manutencoes_gestao(p_projeto_id uuid default null)
returns table (
  id                  uuid,
  projeto_id          uuid,
  projeto_nome        text,
  etapa_id            uuid,
  mundo_nome          text,
  local_ponto         text,
  descricao           text,
  registrado_por_nome text,
  total_fotos         bigint,
  criado_em           timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; v_perfil text; v_ativo boolean; v_uid uuid; v_todos boolean;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  return query
  select
    m.id, m.projeto_id, coalesce(p.cliente, p.shopping)::text,
    m.etapa_id, ep.nome::text, m.local_ponto::text, m.descricao::text,
    m.registrado_por_nome::text,
    (select count(*) from public.manutencao_anexos a where a.manutencao_id = m.id),
    m.criado_em
  from public.manutencoes m
  join public.projetos p on p.id = m.projeto_id
  left join public.etapas_projeto ep on ep.id = m.etapa_id
  where (p_projeto_id is null or m.projeto_id = p_projeto_id)
    and (
      v_todos
      or p.responsavel_comercial = v_nome
      or exists (
        select 1 from public.projeto_usuarios pu
        where pu.projeto_id = m.projeto_id and pu.usuario_id = v_uid
      )
    )
  order by m.criado_em desc;
end;
$$;

revoke all on function public.fdl_listar_manutencoes_gestao(uuid) from public, anon;
grant execute on function public.fdl_listar_manutencoes_gestao(uuid) to authenticated;

create or replace function public.fdl_obter_manutencao_gestao(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; v_perfil text; v_ativo boolean; v_uid uuid; v_todos boolean; v jsonb;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  select jsonb_build_object(
    'id', m.id, 'projeto_id', m.projeto_id,
    'projeto_nome', coalesce(p.cliente, p.shopping),
    'etapa_id', m.etapa_id, 'mundo_nome', ep.nome,
    'local_ponto', m.local_ponto, 'descricao', m.descricao,
    'registrado_por_nome', m.registrado_por_nome, 'criado_em', m.criado_em,
    'anexos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'fase', a.fase, 'tipo', a.tipo,
               'external_file_id', a.external_file_id, 'criado_em', a.criado_em)
             order by a.fase, a.criado_em)
      from public.manutencao_anexos a where a.manutencao_id = m.id), '[]'::jsonb)
  )
  into v
  from public.manutencoes m
  join public.projetos p on p.id = m.projeto_id
  left join public.etapas_projeto ep on ep.id = m.etapa_id
  where m.id = p_id
    and (
      v_todos
      or p.responsavel_comercial = v_nome
      or exists (
        select 1 from public.projeto_usuarios pu
        where pu.projeto_id = m.projeto_id and pu.usuario_id = v_uid
      )
    );

  if v is null then
    raise exception 'Manutenção não encontrada ou fora do seu escopo.';
  end if;

  return v;
end;
$$;

revoke all on function public.fdl_obter_manutencao_gestao(uuid) from public, anon;
grant execute on function public.fdl_obter_manutencao_gestao(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- MONTADOR — lista as manutenções que ele registrou no projeto (para exibir
-- no app dele após registrar).
-- ----------------------------------------------------------------------------
create or replace function public.fdl_listar_manutencoes_montador(
  p_usuario_id uuid,
  p_projeto_id uuid
)
returns table (
  id                  uuid,
  etapa_id            uuid,
  mundo_nome          text,
  local_ponto         text,
  descricao           text,
  total_fotos         bigint,
  criado_em           timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projeto_usuarios pu
    where pu.projeto_id = p_projeto_id and pu.usuario_id = p_usuario_id
  ) then
    raise exception 'Sem vínculo com este projeto.' using errcode = '42501';
  end if;

  return query
  select
    m.id, m.etapa_id, ep.nome::text, m.local_ponto::text, m.descricao::text,
    (select count(*) from public.manutencao_anexos a where a.manutencao_id = m.id),
    m.criado_em
  from public.manutencoes m
  left join public.etapas_projeto ep on ep.id = m.etapa_id
  where m.projeto_id = p_projeto_id
  order by m.criado_em desc;
end;
$$;

revoke all on function public.fdl_listar_manutencoes_montador(uuid, uuid) from public;
grant execute on function public.fdl_listar_manutencoes_montador(uuid, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PÚBLICO — cliente vê pelo link do shopping (/chamado/<token>).
-- Visível na hora (sem validação). Devolve as fotos antes/depois.
-- ----------------------------------------------------------------------------
create or replace function public.fdl_listar_manutencoes_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projeto uuid;
  v jsonb;
begin
  select id into v_projeto from public.projetos
  where chamado_token = p_token;

  if v_projeto is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(item order by (item->>'criado_em') desc), '[]'::jsonb)
  into v
  from (
    select jsonb_build_object(
      'id', m.id,
      'mundo_nome', ep.nome,
      'local_ponto', m.local_ponto,
      'descricao', m.descricao,
      'registrado_por_nome', m.registrado_por_nome,
      'criado_em', m.criado_em,
      'fotos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'external_file_id', a.external_file_id, 'fase', a.fase)
               order by a.fase, a.criado_em)
        from public.manutencao_anexos a
        where a.manutencao_id = m.id and a.external_file_id is not null), '[]'::jsonb)
    ) as item
    from public.manutencoes m
    left join public.etapas_projeto ep on ep.id = m.etapa_id
    where m.projeto_id = v_projeto
  ) sub;

  return v;
end;
$$;

revoke all on function public.fdl_listar_manutencoes_token(text) from public;
grant execute on function public.fdl_listar_manutencoes_token(text) to anon, authenticated;

-- Autorização da foto pública (proxy anônimo do cliente): só serve a foto se
-- ela pertence a uma manutenção do projeto daquele token.
create or replace function public.fdl_anexo_manutencao_publico(
  p_token            text,
  p_external_file_id text
)
returns table (mime_type text, tipo text, nome_arquivo text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select a.mime_type::text, a.tipo::text, a.nome_arquivo::text
  from public.manutencao_anexos a
  join public.manutencoes m on m.id = a.manutencao_id
  join public.projetos p on p.id = m.projeto_id
  where a.external_file_id = p_external_file_id
    and p.chamado_token = p_token
  limit 1;
end;
$$;

revoke all on function public.fdl_anexo_manutencao_publico(text, text) from public;
grant execute on function public.fdl_anexo_manutencao_publico(text, text) to anon, authenticated;
