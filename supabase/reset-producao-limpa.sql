-- ============================================================
-- RESET PARA PRODUÇÃO LIMPA ("marco" para o time usar de verdade)
--
-- ⚠️  DESTRUTIVO E IRREVERSÍVEL. Apaga TODOS os dados operacionais:
--     projetos, etapas, OSs, noites, registros diários, chamados (e anexos/
--     eventos), vínculos de equipe, importações — e, por CASCADE, quaisquer
--     tabelas filhas (ex.: arquivos/registros de OS) mesmo que não listadas.
--
--     NÃO apaga o ESQUEMA nem as FUNÇÕES — só os DADOS. O sistema continua
--     pronto para uso, porém vazio.
--
-- COMO USAR:
--   1) Rode este arquivo no SQL Editor do Supabase de PRODUÇÃO.
--   2) Escolha UMA opção na seção de USUÁRIOS (passo 2).
--   3) Veja as observações no fim (auth.users e mídias no Drive).
--   Faça um backup/branch do banco antes, se quiser poder voltar atrás.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) Zera todos os DADOS operacionais (trunca só o que existir).
--    CASCADE garante que tabelas filhas (mesmo desconhecidas) também
--    sejam zeradas.
-- ------------------------------------------------------------
do $$
declare
  t text;
  alvo text[] := array[
    'importacoes_cronograma',
    'chamado_eventos',
    'chamado_anexos',
    'chamados',
    'registros_diarios',
    'noites_montagem',
    'ordens_servico',
    'etapas_projeto',
    'projeto_usuarios',
    'projetos'
  ];
begin
  foreach t in array alvo loop
    if to_regclass('public.' || t) is not null then
      execute format('truncate table public.%I restart identity cascade', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2) USUÁRIOS — escolha UMA das opções (deixe a outra comentada):
-- ------------------------------------------------------------

-- (A) RECOMENDADO — mantém APENAS o seu admin, para você não ficar sem
--     acesso e já conseguir cadastrar o time. Troque o e-mail abaixo:
delete from public.usuarios
where lower(coalesce(email, '')) <> lower('SEU_EMAIL_ADMIN@empresa.com');

-- (B) ZERAR TODOS os usuários (exige recriar o 1º admin depois — ver
--     observação 1). Se usar esta, comente a opção (A) acima.
-- truncate table public.usuarios restart identity cascade;

-- Histórico de auditoria de usuários (trunca se existir).
do $$
begin
  if to_regclass('public.usuarios_auditoria') is not null then
    truncate table public.usuarios_auditoria restart identity cascade;
  end if;
end $$;

commit;

-- ------------------------------------------------------------
-- Conferência rápida (deve retornar 0, exceto usuarios se usou a opção A).
-- ------------------------------------------------------------
select 'projetos' as tabela, count(*) from public.projetos
union all select 'ordens_servico', count(*) from public.ordens_servico
union all select 'chamados', count(*) from public.chamados
union all select 'usuarios', count(*) from public.usuarios;

-- ============================================================
-- OBSERVAÇÕES (fora do SQL)
--
-- 1) CONTAS DE LOGIN (Supabase Auth): apagar linhas em public.usuarios NÃO
--    apaga as contas de login de e-mail em auth.users. Os montadores (login
--    por Código+PIN) ficam só em public.usuarios e somem aqui. Já os usuários
--    de e-mail (gestão) têm conta em Authentication → Users no painel do
--    Supabase — remova por lá as que não quer manter.
--    Se zerou TODOS (opção B), crie o 1º admin assim:
--      a) Authentication → Users → Add user (e-mail + senha).
--      b) insert into public.usuarios (auth_user_id, nome, email, perfil, ativo)
--         values ('<uuid_do_auth_user>', 'Seu Nome', 'voce@empresa.com',
--                 'admin', true);
--
-- 2) MÍDIAS NO DRIVE: este reset limpa as REFERÊNCIAS no banco, mas as fotos/
--    vídeos já enviados continuam na pasta do Google Drive. Se quiser um marco
--    100% limpo, esvazie também a pasta raiz (GOOGLE_DRIVE_ROOT_FOLDER_ID).
-- ============================================================
