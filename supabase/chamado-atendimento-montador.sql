-- ============================================================
-- ATENDIMENTO DO CHAMADO PELO MONTADOR
-- Rode no SQL Editor do Supabase (teste na preview antes da produção).
--
-- Habilita o montador (acesso por PIN, sem sessão autenticada) a:
--   - anexar fotos separadas por FASE ("antes" / "depois" do atendimento);
--   - mudar o status (em_andamento / resolvido) e registrar observação.
-- Autorização: vínculo montador ↔ projeto do chamado (projeto_usuarios),
-- o mesmo critério já usado por fdl_obter_chamado_montador.
-- ============================================================

alter table public.chamado_anexos
  add column if not exists fase text;  -- 'antes' | 'depois' | null (foto do cliente)

-- ----------------------------------------------------------------------------
-- obter: agora devolve a FASE de cada anexo (para separar antes/depois na UI)
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

-- ----------------------------------------------------------------------------
-- registrar anexo (montador) — igual ao público, mas com FASE e autorização
-- ----------------------------------------------------------------------------
create or replace function public.fdl_registrar_anexo_chamado_montador(
  p_usuario_id         uuid,
  p_chamado_id         uuid,
  p_fase               text,
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
  v_id      uuid;
  v_projeto uuid;
begin
  select c.projeto_id into v_projeto
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

  insert into public.chamado_anexos (
    chamado_id, tipo, fase, nome_arquivo, mime_type, tamanho_bytes,
    provider, external_file_id, external_folder_id, url_visualizacao, caminho_arquivo
  ) values (
    p_chamado_id,
    coalesce(nullif(trim(p_tipo), ''), 'foto'),
    case when nullif(trim(p_fase), '') in ('antes', 'depois')
         then trim(p_fase) else null end,
    p_nome_arquivo, p_mime_type, p_tamanho_bytes,
    coalesce(nullif(trim(p_provider), ''), 'google_drive'),
    p_external_file_id, p_external_folder_id, p_url_visualizacao, p_caminho_arquivo
  )
  returning id into v_id;

  return query select v_id;
end;
$$;

revoke all on function public.fdl_registrar_anexo_chamado_montador(uuid, uuid, text, text, text, text, bigint, text, text, text, text, text) from public;
grant execute on function public.fdl_registrar_anexo_chamado_montador(uuid, uuid, text, text, text, text, bigint, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- atualizar chamado (montador) — status (em_andamento/resolvido) + observação
-- ----------------------------------------------------------------------------
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

  -- Status: o montador só pode colocar em andamento ou resolver.
  if p_status is not null
     and p_status in ('em_andamento', 'resolvido')
     and p_status <> v_status_atual then
    update public.chamados
      set status = p_status,
          resolvido_em = case when p_status = 'resolvido' then now()
                              else resolvido_em end,
          atualizado_em = now()
      where id = p_chamado_id;

    insert into public.chamado_eventos (chamado_id, tipo, de_status, para_status, usuario_id, usuario_nome)
    values (p_chamado_id, 'status', v_status_atual, p_status, p_usuario_id, v_nome);
  end if;

  -- Observação livre do montador.
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
