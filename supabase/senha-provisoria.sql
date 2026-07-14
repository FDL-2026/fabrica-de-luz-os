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
