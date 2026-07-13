-- ============================================================================
-- FÁBRICA DE LUZ — FECHAMENTO DE TEMPORADA (ocorrências + relatórios)
-- ============================================================================
-- Cole no SQL Editor do Supabase e execute. Idempotente.
--
-- Parte 1 (captura): estende o CHECK de registros_diarios.tipo_registro para
--   aceitar os tipos de "ocorrência" que o montador lança no registro da OS.
-- Parte 2 (relatório): RPCs de agregação por temporada (serão adicionadas
--   nesta fase seguinte).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Ocorrências: estende os tipos permitidos no registro diário
-- ----------------------------------------------------------------------------
alter table public.registros_diarios
  drop constraint if exists registros_diarios_tipo_registro_check;

alter table public.registros_diarios
  add constraint registros_diarios_tipo_registro_check
  check (tipo_registro = any (array[
    -- tipos existentes
    'acompanhamento', 'inicio_os', 'conclusao_os', 'pendencia', 'observacao', 'anexo',
    -- ocorrências (dia sem atividade / imprevistos) para o fechamento da temporada
    'ocorr_chuva', 'ocorr_logistica', 'ocorr_acesso', 'ocorr_material',
    'ocorr_retrabalho', 'ocorr_erro_projeto', 'ocorr_evento', 'ocorr_outro'
  ]));
