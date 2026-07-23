-- ============================================================
-- RESPONSÁVEIS DO PROJETO — definir/limpar o Gestor Comercial
-- Rode no SQL Editor do Supabase (teste na preview antes da produção).
--
-- Até aqui não havia como escolher o Gestor Comercial de um projeto fora do
-- texto que vinha na planilha. Cronogramas por "mundos" (Natal do Bem /
-- prefeituras) não trazem gestor, então precisamos escolhê-lo à mão — no
-- preview da importação e na tela de Equipe do projeto.
--
-- fdl_definir_gestor_projeto(projeto, usuario|null):
--   - grava projetos.responsavel_comercial com o nome canônico do gestor;
--   - garante o vínculo em projeto_usuarios (funcao = 'gestor_comercial'),
--     reaproveitando fdl_adicionar_usuario_projeto;
--   - com p_usuario_id NULL, limpa o gestor (texto + vínculo).
-- Permissão: apenas perfis de gestão.
-- ============================================================

create or replace function public.fdl_definir_gestor_projeto(
  p_projeto_id uuid,
  p_usuario_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_perfil text;
  v_nome   text;
begin
  select u.perfil::text
  into v_perfil
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and coalesce(u.ativo, true) is true
  limit 1;

  if v_perfil is null or v_perfil not in (
    'admin', 'diretor', 'gerente_operacional', 'gestor_comercial'
  ) then
    raise exception 'Sem permissão para definir o gestor do projeto.';
  end if;

  -- Remove o vínculo de gestor anterior (substituição/limpeza).
  delete from public.projeto_usuarios
  where projeto_id = p_projeto_id
    and funcao = 'gestor_comercial';

  if p_usuario_id is null then
    update public.projetos
    set responsavel_comercial = null
    where id = p_projeto_id;
    return;
  end if;

  select u.nome::text
  into v_nome
  from public.usuarios u
  where u.id = p_usuario_id
    and u.perfil = 'gestor_comercial'
  limit 1;

  if v_nome is null then
    raise exception 'Usuário informado não é um gestor comercial válido.';
  end if;

  update public.projetos
  set responsavel_comercial = v_nome
  where id = p_projeto_id;

  perform public.fdl_adicionar_usuario_projeto(
    p_projeto_id,
    p_usuario_id,
    'gestor_comercial'
  );
end;
$$;

revoke all on function public.fdl_definir_gestor_projeto(uuid, uuid) from public, anon;
grant execute on function public.fdl_definir_gestor_projeto(uuid, uuid) to authenticated;
