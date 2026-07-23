-- ============================================================
-- VALIDAÇÃO DA RESOLUÇÃO DE CHAMADO PELA GESTÃO
-- Rode DEPOIS de chamado-atendimento-montador.sql (usa a coluna 'fase').
-- Teste na preview antes da produção.
--
-- Fluxo:
--   1. Montador resolve  -> status 'resolvido', validado_em NULL (pendente).
--   2. Gestor é avisado  -> resumo/listar expõem "aguardando validação".
--   3. Gestor valida     -> validado_em = now (revendo as fotos antes/depois).
--   4. Cliente (público) -> só vê "resolvido" + fotos-prova APÓS a validação.
-- ============================================================

alter table public.chamados
  add column if not exists validado_em  timestamptz,
  add column if not exists validado_por  uuid;

-- garante a coluna de fase mesmo que a migração anterior não tenha rodado
alter table public.chamado_anexos
  add column if not exists fase text;

-- ----------------------------------------------------------------------------
-- MONTADOR — obter (agora inclui validado_em) e atualizar (resolver deixa
-- pendente de validação)
-- ----------------------------------------------------------------------------
create or replace function public.fdl_obter_chamado_montador(
  p_usuario_id uuid,
  p_chamado_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'chamado', jsonb_build_object(
      'chamado_id', c.id, 'protocolo', c.protocolo, 'projeto_id', c.projeto_id,
      'cliente', p.cliente, 'shopping', p.shopping, 'uf', p.uf,
      'temporada', p.temporada,
      'categoria', c.categoria, 'prioridade', c.prioridade,
      'local_ponto', c.local_ponto, 'titulo', c.titulo,
      'descricao', c.descricao, 'status', c.status,
      'validado_em', c.validado_em,
      'solicitante_nome', c.solicitante_nome,
      'solicitante_contato', c.solicitante_contato,
      'criado_em', c.criado_em),
    'anexos', coalesce((
       select jsonb_agg(jsonb_build_object(
                'id', a.id, 'tipo', a.tipo, 'fase', a.fase,
                'nome_arquivo', a.nome_arquivo,
                'external_file_id', a.external_file_id, 'criado_em', a.criado_em)
              order by a.criado_em)
       from public.chamado_anexos a where a.chamado_id = c.id), '[]'::jsonb)
  )
  into v
  from public.chamados c
  join public.projetos p on p.id = c.projeto_id
  where c.id = p_chamado_id
    and exists (
      select 1 from public.projeto_usuarios pu
      where pu.projeto_id = c.projeto_id and pu.usuario_id = p_usuario_id
    );

  if v is null then
    raise exception 'Chamado não encontrado ou sem vínculo com este montador.';
  end if;

  return v;
end;
$$;

revoke all on function public.fdl_obter_chamado_montador(uuid, uuid) from public;
grant execute on function public.fdl_obter_chamado_montador(uuid, uuid) to anon, authenticated;

create or replace function public.fdl_atualizar_chamado_montador(
  p_usuario_id uuid,
  p_chamado_id uuid,
  p_status     text default null,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projeto      uuid;
  v_status_atual text;
  v_nome         text;
begin
  select c.projeto_id, c.status into v_projeto, v_status_atual
  from public.chamados c where c.id = p_chamado_id;

  if v_projeto is null then
    raise exception 'Chamado não encontrado.';
  end if;

  if not exists (
    select 1 from public.projeto_usuarios pu
    where pu.projeto_id = v_projeto and pu.usuario_id = p_usuario_id
  ) then
    raise exception 'Sem vínculo com este chamado.' using errcode = '42501';
  end if;

  select nome into v_nome from public.usuarios where id = p_usuario_id;

  if p_status is not null
     and p_status in ('em_andamento', 'resolvido')
     and p_status <> v_status_atual then
    -- Para RESOLVER, exige pelo menos 1 foto ANTES e 1 foto DEPOIS.
    if p_status = 'resolvido' then
      if (select count(*) from public.chamado_anexos a
            where a.chamado_id = p_chamado_id and a.fase = 'antes') < 1
         or (select count(*) from public.chamado_anexos a
            where a.chamado_id = p_chamado_id and a.fase = 'depois') < 1 then
        raise exception
          'Para resolver o chamado, anexe pelo menos 1 foto de ANTES e 1 de DEPOIS.'
          using errcode = 'P0001';
      end if;
    end if;

    update public.chamados
      set status = p_status,
          resolvido_em = case when p_status = 'resolvido' then now()
                              else resolvido_em end,
          -- Resolver deixa PENDENTE de validação da gestão.
          validado_em = case when p_status = 'resolvido' then null
                             else validado_em end,
          atualizado_em = now()
      where id = p_chamado_id;

    insert into public.chamado_eventos (chamado_id, tipo, de_status, para_status, usuario_id, usuario_nome)
    values (p_chamado_id, 'status', v_status_atual, p_status, p_usuario_id, v_nome);
  end if;

  if char_length(coalesce(trim(p_observacao), '')) > 0 then
    update public.chamados set atualizado_em = now() where id = p_chamado_id;
    insert into public.chamado_eventos (chamado_id, tipo, descricao, usuario_id, usuario_nome)
    values (p_chamado_id, 'observacao', trim(p_observacao), p_usuario_id, v_nome);
  end if;

  return public.fdl_obter_chamado_montador(p_usuario_id, p_chamado_id);
end;
$$;

revoke all on function public.fdl_atualizar_chamado_montador(uuid, uuid, text, text) from public;
grant execute on function public.fdl_atualizar_chamado_montador(uuid, uuid, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — validar a resolução
-- ----------------------------------------------------------------------------
create or replace function public.fdl_validar_chamado_gestao(p_chamado_id uuid)
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

  if v_atual.status <> 'resolvido' then
    raise exception 'Só é possível validar um chamado resolvido.';
  end if;

  update public.chamados
    set validado_em = now(), validado_por = v_uid, atualizado_em = now()
    where id = p_chamado_id;

  insert into public.chamado_eventos (chamado_id, tipo, descricao, usuario_id, usuario_nome)
  values (p_chamado_id, 'validacao', 'Resolução validada pela gestão', v_uid, v_nome);

  return public.fdl_obter_chamado_gestao(p_chamado_id);
end;
$$;

revoke all on function public.fdl_validar_chamado_gestao(uuid) from public, anon;
grant execute on function public.fdl_validar_chamado_gestao(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- GESTÃO — resumo e lista agora sinalizam "aguardando validação"
-- ----------------------------------------------------------------------------
-- Assinatura mudou (nova coluna): é preciso dropar antes de recriar.
drop function if exists public.fdl_resumo_chamados_gestao();

create or replace function public.fdl_resumo_chamados_gestao()
returns table (
  abertos               bigint,
  em_andamento          bigint,
  aguardando            bigint,
  resolvidos            bigint,
  aguardando_validacao  bigint,
  total                 bigint
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
    count(*) filter (where status = 'resolvido' and validado_em is null),
    count(*)
  from public.chamados c
  where v_todos or c.responsavel_comercial = v_nome;
end;
$$;

revoke all on function public.fdl_resumo_chamados_gestao() from public, anon;
grant execute on function public.fdl_resumo_chamados_gestao() to authenticated;

-- Assinatura mudou (nova coluna validado_em): dropar antes de recriar.
drop function if exists public.fdl_listar_chamados_gestao(text, uuid);

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
  resolvido_em          timestamptz,
  validado_em           timestamptz
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
    c.id, c.protocolo::text, p.id, p.cliente::text, p.shopping::text,
    p.uf::text, p.temporada::text,
    c.responsavel_comercial::text, c.solicitante_nome::text, c.solicitante_contato::text,
    c.categoria::text, c.prioridade::text, c.local_ponto::text, c.titulo::text,
    c.descricao::text, c.status::text,
    c.atribuido_usuario_id, u.nome::text,
    (select count(*) from public.chamado_anexos a where a.chamado_id = c.id),
    c.criado_em, c.atualizado_em, c.resolvido_em, c.validado_em
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

-- ----------------------------------------------------------------------------
-- PÚBLICO — acompanhamento do cliente
--   * status só vira "resolvido" após a validação (antes: "em_andamento");
--   * fotos-prova (antes/depois do montador) só aparecem após validar;
--   * a linha do tempo esconde o evento "resolvido" enquanto não validado.
-- ----------------------------------------------------------------------------
create or replace function public.fdl_acompanhar_chamado(p_protocolo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'protocolo',   c.protocolo,
    'status',      case when c.status = 'resolvido' and c.validado_em is null
                        then 'em_andamento' else c.status end,
    'categoria',   c.categoria,
    'prioridade',  c.prioridade,
    'titulo',      c.titulo,
    'shopping',    coalesce(p.shopping, p.cliente),
    'criado_em',   c.criado_em,
    'resolvido_em', case when c.validado_em is not null then c.resolvido_em else null end,
    'validado',    (c.validado_em is not null),
    'fotos_resolucao', case when c.validado_em is not null then coalesce((
        select jsonb_agg(
                 jsonb_build_object('external_file_id', a.external_file_id, 'fase', a.fase)
                 order by a.fase, a.criado_em)
        from public.chamado_anexos a
        where a.chamado_id = c.id
          and a.fase in ('antes', 'depois')
          and a.external_file_id is not null
      ), '[]'::jsonb) else '[]'::jsonb end,
    'linha_tempo', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'tipo', e.tipo,
                   'para_status', e.para_status,
                   'descricao', e.descricao,
                   'criado_em', e.criado_em
                 ) order by e.criado_em)
        from public.chamado_eventos e
        where e.chamado_id = c.id and e.tipo in ('criado', 'status')
          and (c.validado_em is not null or coalesce(e.para_status, '') <> 'resolvido')
      ), '[]'::jsonb)
  )
  into v
  from public.chamados c
  join public.projetos p on p.id = c.projeto_id
  where upper(trim(c.protocolo)) = upper(trim(coalesce(p_protocolo, '')));

  if v is null then
    raise exception 'Chamado não encontrado. Confira o número do protocolo.';
  end if;

  return v;
end;
$$;

revoke all on function public.fdl_acompanhar_chamado(text) from public;
grant execute on function public.fdl_acompanhar_chamado(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PÚBLICO — autorização de foto-prova (para o proxy anônimo do cliente)
-- Só serve fotos antes/depois do montador e só se o chamado estiver validado.
-- ----------------------------------------------------------------------------
create or replace function public.fdl_anexo_chamado_publico(
  p_protocolo        text,
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
  from public.chamado_anexos a
  join public.chamados c on c.id = a.chamado_id
  where a.external_file_id = p_external_file_id
    and upper(trim(c.protocolo)) = upper(trim(coalesce(p_protocolo, '')))
    and c.validado_em is not null
    and a.fase in ('antes', 'depois')
  limit 1;
end;
$$;

revoke all on function public.fdl_anexo_chamado_publico(text, text) from public;
grant execute on function public.fdl_anexo_chamado_publico(text, text) to anon, authenticated;
