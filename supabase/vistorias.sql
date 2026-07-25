-- ============================================================
-- VISTORIAS TÉCNICAS (V.T.) — relatório pré-montado + link de preenchimento
-- Rode no SQL Editor do Supabase (teste na preview antes da produção).
--
-- Fluxo:
--   1) A gestão PRÉ-PREENCHE a VT: projeto, endereço, eng. responsável, data e
--      os PONTOS/layouts. Cada ponto tem um TIPO de decoração e recebe um
--      checklist sugerido (as "tasks" que guiam o que observar), editável.
--   2) Gera um LINK compartilhável (/vt/<token>).
--   3) O responsável abre o link no local (sem login) e preenche o checklist,
--      anota e anexa fotos geo-carimbadas. Ao final marca "VT concluída".
--   4) A gestão é avisada (card + lista) e o relatório fica pronto para
--      visualizar/exportar.
--
-- O conteúdo do checklist é guardado como JSONB (flexível e editável): o
-- template de cada tipo vive no front (lib/vistoria/templates.ts) e aqui só
-- persistimos o snapshot com as respostas.
-- ============================================================

create table if not exists public.vistorias (
  id                 uuid primary key default gen_random_uuid(),
  projeto_id         uuid references public.projetos(id) on delete set null,
  titulo             text not null,
  endereco           text,
  eng_responsavel    text,
  data_prevista      date,
  token              text not null unique,
  status             text not null default 'aguardando', -- 'aguardando' | 'concluida'
  conferencia        jsonb not null default '{}'::jsonb,
  preenchido_por_nome text,
  acompanhante_nome    text,
  acompanhante_contato text,
  acompanhante_area    text,
  criado_por         uuid references public.usuarios(id) on delete set null,
  criado_por_nome    text,
  criado_em          timestamptz not null default now(),
  concluida_em       timestamptz
);

-- Para bancos já criados antes destas colunas:
alter table public.vistorias
  add column if not exists acompanhante_nome    text,
  add column if not exists acompanhante_contato text,
  add column if not exists acompanhante_area    text;

create index if not exists vistorias_projeto_idx on public.vistorias (projeto_id);
create index if not exists vistorias_token_idx   on public.vistorias (token);
create index if not exists vistorias_criado_idx  on public.vistorias (criado_em desc);

-- Locais/praças de uma vistoria (agrupam os pontos por endereço).
create table if not exists public.vistoria_locais (
  id           uuid primary key default gen_random_uuid(),
  vistoria_id  uuid not null references public.vistorias(id) on delete cascade,
  nome         text not null,
  endereco     text,
  ordem        int  not null default 0,
  criado_em    timestamptz not null default now()
);

create index if not exists vistoria_locais_idx on public.vistoria_locais (vistoria_id, ordem);

create table if not exists public.vistoria_pontos (
  id           uuid primary key default gen_random_uuid(),
  vistoria_id  uuid not null references public.vistorias(id) on delete cascade,
  local_id     uuid references public.vistoria_locais(id) on delete cascade,
  nome         text not null,
  tipo         text not null,
  ordem        int  not null default 0,
  itens        jsonb not null default '[]'::jsonb,
  anotacoes    text,
  criado_em    timestamptz not null default now()
);

-- Para bancos já criados antes da camada de locais:
alter table public.vistoria_pontos
  add column if not exists local_id uuid references public.vistoria_locais(id) on delete cascade;

create index if not exists vistoria_pontos_idx       on public.vistoria_pontos (vistoria_id, ordem);
create index if not exists vistoria_pontos_local_idx on public.vistoria_pontos (local_id, ordem);

-- Backfill: para vistorias antigas cujos pontos não têm local, cria um local
-- padrão (com o endereço da vistoria) e vincula os pontos a ele.
do $$
declare
  r record;
  v_local uuid;
begin
  for r in
    select distinct p.vistoria_id
    from public.vistoria_pontos p
    where p.local_id is null
  loop
    insert into public.vistoria_locais (vistoria_id, nome, endereco, ordem)
    select r.vistoria_id, 'Local único', v.endereco, 0
    from public.vistorias v where v.id = r.vistoria_id
    returning id into v_local;

    update public.vistoria_pontos
       set local_id = v_local
     where vistoria_id = r.vistoria_id and local_id is null;
  end loop;
end $$;

create table if not exists public.vistoria_anexos (
  id                 uuid primary key default gen_random_uuid(),
  vistoria_id        uuid not null references public.vistorias(id) on delete cascade,
  ponto_id           uuid references public.vistoria_pontos(id) on delete cascade,
  tipo               text not null default 'foto',
  categoria          text not null default 'in_loco', -- 'referencia' | 'in_loco'
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

-- Para bancos já criados antes desta coluna:
alter table public.vistoria_anexos
  add column if not exists categoria text not null default 'in_loco';

create index if not exists vistoria_anexos_idx       on public.vistoria_anexos (vistoria_id);
create index if not exists vistoria_anexos_ponto_idx on public.vistoria_anexos (ponto_id);

alter table public.vistorias       enable row level security;
alter table public.vistoria_locais enable row level security;
alter table public.vistoria_pontos enable row level security;
alter table public.vistoria_anexos enable row level security;
revoke all on public.vistorias, public.vistoria_locais, public.vistoria_pontos,
  public.vistoria_anexos from anon, authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — cria a VT com seus locais/pontos e devolve o token do link.
-- p_locais: jsonb array [{
--   "nome": text, "endereco": text,
--   "pontos": [{ "nome": text, "tipo": text, "itens": jsonb, "anotacoes": text }]
-- }]
-- p_titulo é opcional: se vazio, é derivado do projeto.
-- (p_endereco mantido por compatibilidade de assinatura; não é mais usado.)
-- ----------------------------------------------------------------------------
-- Assinatura anterior usava p_pontos; renomeamos para p_locais. Como o
-- CREATE OR REPLACE não renomeia parâmetros, removemos QUALQUER versão
-- existente da função (independente da assinatura) antes de recriar.
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig from pg_proc
    where proname = 'fdl_criar_vistoria' and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create or replace function public.fdl_criar_vistoria(
  p_projeto_id    uuid,
  p_titulo        text,
  p_endereco      text,
  p_eng           text,
  p_data_prevista date,
  p_locais        jsonb
)
returns table (vistoria_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_nome   text;
  v_perfil text;
  v_ativo  boolean;
  v_token  text;
  v_id     uuid;
  v_titulo text;
  v_local_json jsonb;
  v_local  uuid;
  v_local_ordem int := 0;
  v_ponto  jsonb;
  v_ponto_ordem int;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();

  if v_uid is null or not coalesce(v_ativo, false) or v_perfil = 'visitante' then
    raise exception 'Sessão inválida ou sem permissão.' using errcode = '42501';
  end if;

  -- Se vinculada a projeto, quem não tem visão total precisa de vínculo.
  if p_projeto_id is not null
     and v_perfil not in ('admin', 'diretor', 'gerente_operacional')
     and not exists (
       select 1 from public.projeto_usuarios pu
       where pu.projeto_id = p_projeto_id and pu.usuario_id = v_uid
     ) then
    raise exception 'Sem acesso a este projeto.' using errcode = '42501';
  end if;

  -- Título: usa o informado; senão deriva do projeto; senão genérico.
  v_titulo := nullif(trim(p_titulo), '');
  if v_titulo is null and p_projeto_id is not null then
    select coalesce(p.cliente, p.shopping) into v_titulo
    from public.projetos p where p.id = p_projeto_id;
  end if;
  v_titulo := coalesce(v_titulo, 'Vistoria técnica');

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.vistorias (
    projeto_id, titulo, eng_responsavel, data_prevista,
    token, criado_por, criado_por_nome
  ) values (
    p_projeto_id, v_titulo, nullif(trim(p_eng), ''),
    p_data_prevista, v_token, v_uid, v_nome
  )
  returning id into v_id;

  if p_locais is not null and jsonb_typeof(p_locais) = 'array' then
    for v_local_json in select * from jsonb_array_elements(p_locais)
    loop
      insert into public.vistoria_locais (vistoria_id, nome, endereco, ordem)
      values (
        v_id,
        coalesce(nullif(trim(v_local_json->>'nome'), ''), 'Local ' || (v_local_ordem + 1)),
        nullif(trim(v_local_json->>'endereco'), ''),
        v_local_ordem
      )
      returning id into v_local;

      v_ponto_ordem := 0;
      if jsonb_typeof(v_local_json->'pontos') = 'array' then
        for v_ponto in select * from jsonb_array_elements(v_local_json->'pontos')
        loop
          insert into public.vistoria_pontos (
            vistoria_id, local_id, nome, tipo, ordem, itens, anotacoes
          ) values (
            v_id, v_local,
            coalesce(nullif(trim(v_ponto->>'nome'), ''), 'Ponto ' || (v_ponto_ordem + 1)),
            coalesce(nullif(trim(v_ponto->>'tipo'), ''), 'outros'),
            v_ponto_ordem,
            coalesce(v_ponto->'itens', '[]'::jsonb),
            nullif(trim(v_ponto->>'anotacoes'), '')
          );
          v_ponto_ordem := v_ponto_ordem + 1;
        end loop;
      end if;

      v_local_ordem := v_local_ordem + 1;
    end loop;
  end if;

  return query select v_id, v_token;
end;
$$;

revoke all on function public.fdl_criar_vistoria(uuid, text, text, text, date, jsonb) from public, anon;
grant execute on function public.fdl_criar_vistoria(uuid, text, text, text, date, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — resumo (card do dashboard)
--   concluidas_recentes: concluídas nos últimos 7 dias (o aviso)
--   aguardando: ainda não preenchidas
-- ----------------------------------------------------------------------------
create or replace function public.fdl_resumo_vistorias_gestao()
returns table (concluidas_recentes bigint, aguardando bigint, total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid; v_nome text; v_perfil text; v_ativo boolean; v_todos boolean;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  return query
  select
    count(*) filter (
      where v.status = 'concluida' and v.concluida_em >= now() - interval '7 days'
    ),
    count(*) filter (where v.status = 'aguardando'),
    count(*)
  from public.vistorias v
  left join public.projetos p on p.id = v.projeto_id
  where v_todos
     or v.criado_por = v_uid
     or (v.projeto_id is not null and (
          p.responsavel_comercial = v_nome
          or exists (
            select 1 from public.projeto_usuarios pu
            where pu.projeto_id = v.projeto_id and pu.usuario_id = v_uid
          )
        ));
end;
$$;

revoke all on function public.fdl_resumo_vistorias_gestao() from public, anon;
grant execute on function public.fdl_resumo_vistorias_gestao() to authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — lista
-- ----------------------------------------------------------------------------
create or replace function public.fdl_listar_vistorias_gestao(p_projeto_id uuid default null)
returns table (
  id                  uuid,
  projeto_id          uuid,
  projeto_nome        text,
  titulo              text,
  endereco            text,
  eng_responsavel     text,
  data_prevista       date,
  token               text,
  status              text,
  total_pontos        bigint,
  total_fotos         bigint,
  preenchido_por_nome text,
  criado_em           timestamptz,
  concluida_em        timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid; v_nome text; v_perfil text; v_ativo boolean; v_todos boolean;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  return query
  select
    v.id, v.projeto_id, coalesce(p.cliente, p.shopping)::text,
    v.titulo::text, v.endereco::text, v.eng_responsavel::text,
    v.data_prevista, v.token::text, v.status::text,
    (select count(*) from public.vistoria_pontos vp where vp.vistoria_id = v.id),
    (select count(*) from public.vistoria_anexos va where va.vistoria_id = v.id),
    v.preenchido_por_nome::text, v.criado_em, v.concluida_em
  from public.vistorias v
  left join public.projetos p on p.id = v.projeto_id
  where (p_projeto_id is null or v.projeto_id = p_projeto_id)
    and (
      v_todos
      or v.criado_por = v_uid
      or (v.projeto_id is not null and (
            p.responsavel_comercial = v_nome
            or exists (
              select 1 from public.projeto_usuarios pu
              where pu.projeto_id = v.projeto_id and pu.usuario_id = v_uid
            )
          ))
    )
  order by v.criado_em desc;
end;
$$;

revoke all on function public.fdl_listar_vistorias_gestao(uuid) from public, anon;
grant execute on function public.fdl_listar_vistorias_gestao(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — detalhe completo (para tela e relatório)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_obter_vistoria_gestao(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid; v_nome text; v_perfil text; v_ativo boolean; v_todos boolean; v jsonb;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  select jsonb_build_object(
    'id', v.id, 'projeto_id', v.projeto_id,
    'projeto_nome', coalesce(p.cliente, p.shopping),
    'titulo', v.titulo,
    'eng_responsavel', v.eng_responsavel, 'data_prevista', v.data_prevista,
    'token', v.token, 'status', v.status, 'conferencia', v.conferencia,
    'preenchido_por_nome', v.preenchido_por_nome,
    'acompanhante_nome', v.acompanhante_nome,
    'acompanhante_contato', v.acompanhante_contato,
    'acompanhante_area', v.acompanhante_area,
    'criado_por_nome', v.criado_por_nome,
    'criado_em', v.criado_em, 'concluida_em', v.concluida_em,
    'locais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', vl.id, 'nome', vl.nome, 'endereco', vl.endereco,
               'ordem', vl.ordem,
               'pontos', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', vp.id, 'nome', vp.nome, 'tipo', vp.tipo,
                          'ordem', vp.ordem, 'itens', vp.itens, 'anotacoes', vp.anotacoes,
                          'fotos', coalesce((
                            select jsonb_agg(jsonb_build_object(
                                     'id', a.id, 'external_file_id', a.external_file_id,
                                     'categoria', a.categoria,
                                     'criado_em', a.criado_em) order by a.criado_em)
                            from public.vistoria_anexos a
                            where a.ponto_id = vp.id and a.external_file_id is not null), '[]'::jsonb)
                        ) order by vp.ordem)
                 from public.vistoria_pontos vp where vp.local_id = vl.id), '[]'::jsonb)
             ) order by vl.ordem)
      from public.vistoria_locais vl where vl.vistoria_id = v.id), '[]'::jsonb)
  )
  into v
  from public.vistorias v
  left join public.projetos p on p.id = v.projeto_id
  where v.id = p_id
    and (
      v_todos
      or v.criado_por = v_uid
      or (v.projeto_id is not null and (
            p.responsavel_comercial = v_nome
            or exists (
              select 1 from public.projeto_usuarios pu
              where pu.projeto_id = v.projeto_id and pu.usuario_id = v_uid
            )
          ))
    );

  if v is null then
    raise exception 'Vistoria não encontrada ou fora do seu escopo.';
  end if;

  return v;
end;
$$;

revoke all on function public.fdl_obter_vistoria_gestao(uuid) from public, anon;
grant execute on function public.fdl_obter_vistoria_gestao(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — excluir vistoria
-- ----------------------------------------------------------------------------
create or replace function public.fdl_excluir_vistoria_gestao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid; v_nome text; v_perfil text; v_ativo boolean; v_todos boolean; v_ok boolean;
begin
  select usuario_id, nome, perfil, ativo into v_uid, v_nome, v_perfil, v_ativo
  from public.fdl_chamado_ator();
  if v_perfil is null or not coalesce(v_ativo, false) then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  v_todos := v_perfil in ('admin', 'diretor', 'gerente_operacional');

  select (v_todos or v.criado_por = v_uid) into v_ok
  from public.vistorias v where v.id = p_id;

  if not coalesce(v_ok, false) then
    raise exception 'Sem permissão para excluir esta vistoria.' using errcode = '42501';
  end if;

  delete from public.vistorias where id = p_id;
end;
$$;

revoke all on function public.fdl_excluir_vistoria_gestao(uuid) from public, anon;
grant execute on function public.fdl_excluir_vistoria_gestao(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- PÚBLICO (token) — carrega a VT para preenchimento no local
-- ----------------------------------------------------------------------------
create or replace function public.fdl_obter_vistoria_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'id', v.id, 'titulo', v.titulo,
    'eng_responsavel', v.eng_responsavel, 'data_prevista', v.data_prevista,
    'status', v.status, 'conferencia', v.conferencia,
    'preenchido_por_nome', v.preenchido_por_nome,
    'acompanhante_nome', v.acompanhante_nome,
    'acompanhante_contato', v.acompanhante_contato,
    'acompanhante_area', v.acompanhante_area,
    'projeto_nome', coalesce(p.cliente, p.shopping),
    'locais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', vl.id, 'nome', vl.nome, 'endereco', vl.endereco,
               'ordem', vl.ordem,
               'pontos', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', vp.id, 'nome', vp.nome, 'tipo', vp.tipo,
                          'ordem', vp.ordem, 'itens', vp.itens, 'anotacoes', vp.anotacoes,
                          'fotos', coalesce((
                            select jsonb_agg(jsonb_build_object(
                                     'external_file_id', a.external_file_id,
                                     'categoria', a.categoria) order by a.criado_em)
                            from public.vistoria_anexos a
                            where a.ponto_id = vp.id and a.external_file_id is not null), '[]'::jsonb)
                        ) order by vp.ordem)
                 from public.vistoria_pontos vp where vp.local_id = vl.id), '[]'::jsonb)
             ) order by vl.ordem)
      from public.vistoria_locais vl where vl.vistoria_id = v.id), '[]'::jsonb)
  )
  into v
  from public.vistorias v
  left join public.projetos p on p.id = v.projeto_id
  where v.token = p_token;

  return v; -- null se token inválido
end;
$$;

revoke all on function public.fdl_obter_vistoria_token(text) from public;
grant execute on function public.fdl_obter_vistoria_token(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PÚBLICO (token) — salva o preenchimento (rascunho) ou conclui.
-- p_pontos: jsonb array [{ "id": uuid, "itens": jsonb, "anotacoes": text }]
-- ----------------------------------------------------------------------------
-- Assinatura anterior (sem acompanhante) — remove qualquer versão antes de recriar.
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig from pg_proc
    where proname = 'fdl_salvar_vistoria_token' and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create or replace function public.fdl_salvar_vistoria_token(
  p_token             text,
  p_conferencia       jsonb,
  p_preenchido_por    text,
  p_pontos            jsonb,
  p_concluir          boolean default false,
  p_acomp_nome        text default null,
  p_acomp_contato     text default null,
  p_acomp_area        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_status text;
  v_ponto  jsonb;
begin
  select id, status into v_id, v_status
  from public.vistorias where token = p_token;

  if v_id is null then
    raise exception 'Link inválido.';
  end if;

  if v_status = 'concluida' then
    raise exception 'Esta vistoria já foi concluída.';
  end if;

  if p_concluir and (p_preenchido_por is null or length(trim(p_preenchido_por)) = 0) then
    raise exception 'Informe o nome de quem realizou a vistoria.';
  end if;

  update public.vistorias
     set conferencia         = coalesce(p_conferencia, '{}'::jsonb),
         preenchido_por_nome = nullif(trim(p_preenchido_por), ''),
         acompanhante_nome    = nullif(trim(p_acomp_nome), ''),
         acompanhante_contato = nullif(trim(p_acomp_contato), ''),
         acompanhante_area    = nullif(trim(p_acomp_area), ''),
         status              = case when p_concluir then 'concluida' else status end,
         concluida_em        = case when p_concluir then now() else concluida_em end
   where id = v_id;

  if p_pontos is not null and jsonb_typeof(p_pontos) = 'array' then
    for v_ponto in select * from jsonb_array_elements(p_pontos)
    loop
      update public.vistoria_pontos
         set itens     = coalesce(v_ponto->'itens', itens),
             anotacoes = nullif(trim(v_ponto->>'anotacoes'), '')
       where id = (v_ponto->>'id')::uuid
         and vistoria_id = v_id;
    end loop;
  end if;

  return jsonb_build_object('id', v_id, 'concluida', p_concluir);
end;
$$;

revoke all on function public.fdl_salvar_vistoria_token(text, jsonb, text, jsonb, boolean, text, text, text) from public;
grant execute on function public.fdl_salvar_vistoria_token(text, jsonb, text, jsonb, boolean, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PÚBLICO (token) — contexto do projeto para a rota de upload de foto.
-- Valida que o ponto pertence à vistoria do token e que ainda pode receber
-- fotos (não concluída).
-- ----------------------------------------------------------------------------
create or replace function public.fdl_contexto_vistoria_token(
  p_token    text,
  p_ponto_id uuid
)
returns table (
  vistoria_id uuid, projeto_id uuid, titulo text,
  cliente text, shopping text, uf text, temporada text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_proj   uuid;
  v_titulo text;
  v_status text;
begin
  select v.id, v.projeto_id, v.titulo, v.status
    into v_id, v_proj, v_titulo, v_status
  from public.vistorias v where v.token = p_token;

  if v_id is null then
    raise exception 'Link inválido.';
  end if;
  if v_status = 'concluida' then
    raise exception 'Esta vistoria já foi concluída.';
  end if;
  if not exists (
    select 1 from public.vistoria_pontos vp
    where vp.id = p_ponto_id and vp.vistoria_id = v_id
  ) then
    raise exception 'Ponto não pertence a esta vistoria.';
  end if;

  return query
  select v_id, v_proj, v_titulo,
         p.cliente::text, p.shopping::text, p.uf::text, p.temporada::text
  from (select 1) x
  left join public.projetos p on p.id = v_proj;
end;
$$;

revoke all on function public.fdl_contexto_vistoria_token(text, uuid) from public;
grant execute on function public.fdl_contexto_vistoria_token(text, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PÚBLICO (token) — registra o anexo (foto) de um ponto
-- ----------------------------------------------------------------------------
-- Assinatura anterior (sem categoria) — remove qualquer versão antes de recriar.
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig from pg_proc
    where proname = 'fdl_registrar_anexo_vistoria_token' and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create or replace function public.fdl_registrar_anexo_vistoria_token(
  p_token              text,
  p_ponto_id           uuid,
  p_tipo               text,
  p_nome_arquivo       text,
  p_mime_type          text,
  p_tamanho_bytes      bigint,
  p_provider           text,
  p_external_file_id   text,
  p_external_folder_id text,
  p_url_visualizacao   text,
  p_caminho_arquivo    text,
  p_categoria          text default 'in_loco'
)
returns table (anexo_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_anexo uuid;
begin
  select v.id into v_id
  from public.vistorias v
  join public.vistoria_pontos vp on vp.vistoria_id = v.id
  where v.token = p_token and vp.id = p_ponto_id;

  if v_id is null then
    raise exception 'Ponto/vistoria não encontrado para este link.';
  end if;

  insert into public.vistoria_anexos (
    vistoria_id, ponto_id, tipo, categoria, nome_arquivo, mime_type, tamanho_bytes,
    provider, external_file_id, external_folder_id, url_visualizacao, caminho_arquivo
  ) values (
    v_id, p_ponto_id, coalesce(nullif(trim(p_tipo), ''), 'foto'),
    case when nullif(trim(p_categoria), '') = 'referencia' then 'referencia' else 'in_loco' end,
    p_nome_arquivo, p_mime_type, p_tamanho_bytes,
    coalesce(nullif(trim(p_provider), ''), 'google_drive'),
    p_external_file_id, p_external_folder_id, p_url_visualizacao, p_caminho_arquivo
  )
  returning id into v_anexo;

  return query select v_anexo;
end;
$$;

revoke all on function public.fdl_registrar_anexo_vistoria_token(text, uuid, text, text, text, bigint, text, text, text, text, text, text) from public;
grant execute on function public.fdl_registrar_anexo_vistoria_token(text, uuid, text, text, text, bigint, text, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PÚBLICO — autorização do proxy de foto (link de preenchimento)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_anexo_vistoria_publico(
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
  from public.vistoria_anexos a
  join public.vistorias v on v.id = a.vistoria_id
  where a.external_file_id = p_external_file_id
    and v.token = p_token
  limit 1;
end;
$$;

revoke all on function public.fdl_anexo_vistoria_publico(text, text) from public;
grant execute on function public.fdl_anexo_vistoria_publico(text, text) to anon, authenticated;
