-- ============================================================
-- SEED DE TESTE · FÁBRICA DE LUZ OS · TEMPORADA 2026
-- Rode no SQL Editor do Supabase.
--
-- ATENÇÃO: a seção 1 APAGA TODOS os projetos existentes e tudo
-- que depende deles (OSs, registros, anexos, vínculos, noites).
-- Use apenas em ambiente de teste.
--
-- O que este script cria:
--   • 80 projetos distribuídos entre 5 gestores comerciais
--   • ~640 OSs com cronograma e estados variados (adiantado,
--     em linha, atrasado e crítico) com aprovações espalhadas
--     pelos últimos 14 dias — inclusive nas últimas 24h
--   • Usuários: 5 gestores comerciais, 1 gerente operacional,
--     2 diretores e 6 montadores (login por Código + PIN 1234)
--   • Montadores vinculados aos projetos (projeto_usuarios)
-- ============================================================

-- ------------------------------------------------------------
-- 1. LIMPEZA (destrutivo: remove todos os projetos e filhos)
-- ------------------------------------------------------------
truncate table projetos cascade;

-- ------------------------------------------------------------
-- 2. USUÁRIOS (via RPC oficial — trata o PIN corretamente)
--    Gestores/diretores/gerente ficam sem login por enquanto
--    (p_auth_user_id null); para dar acesso real a eles depois,
--    cadastre pela tela Usuários. Montadores já logam com PIN.
-- ------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('Bruno Koga',      'bruno.koga@fabricadeluz.com.br',      'gestor_comercial',    'email', null::text, null::text),
      ('Lucas Borges',    'lucas.borges@fabricadeluz.com.br',    'gestor_comercial',    'email', null, null),
      ('Acácio Pires',    'acacio.pires@fabricadeluz.com.br',    'gestor_comercial',    'email', null, null),
      ('Arthur Palhares', 'arthur.palhares@fabricadeluz.com.br', 'gestor_comercial',    'email', null, null),
      ('Hiron Mendes',    'hiron.mendes@fabricadeluz.com.br',    'gestor_comercial',    'email', null, null),
      ('Wagner Vilela',   'wagner.vilela@fabricadeluz.com.br',   'gerente_operacional', 'email', null, null),
      ('Bruno Cruz',      'bruno.cruz@fabricadeluz.com.br',      'diretor',             'email', null, null),
      ('Pedro Minasi',    'pedro.minasi@fabricadeluz.com.br',    'diretor',             'email', null, null),
      ('Marcos Maia',     null,                                  'montador',            'pin',   'M0001', '1234'),
      ('Aryane',          null,                                  'montador',            'pin',   'M0002', '1234'),
      ('Judson',          null,                                  'montador',            'pin',   'M0003', '1234'),
      ('Daniel',          null,                                  'montador',            'pin',   'M0004', '1234'),
      ('Carlos Magno',    null,                                  'montador',            'pin',   'M0005', '1234'),
      ('Patrick',         null,                                  'montador',            'pin',   'M0006', '1234')
    ) as t(nome, email, perfil, tipo_login, codigo, pin)
  loop
    -- pula quem já existe (por e-mail ou por código de acesso)
    if u.email is not null
       and exists (select 1 from usuarios where lower(email) = lower(u.email)) then
      continue;
    end if;

    if u.codigo is not null
       and exists (select 1 from usuarios where upper(codigo_acesso) = upper(u.codigo)) then
      continue;
    end if;

    perform fdl_salvar_usuario_gestao(
      u.nome, u.email, u.perfil, u.tipo_login, u.codigo, u.pin, null, true
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. PROJETOS + OSs + VÍNCULOS
--    Desativa temporariamente os gatilhos de negócio (ex.: a
--    exigência de 7 registros para concluir OS) apenas durante
--    a carga de dados de teste. Reativado na seção 4.
-- ------------------------------------------------------------
set session_replication_role = replica;

do $$
declare
  gestores text[] := array['Bruno Koga', 'Lucas Borges', 'Acácio Pires', 'Arthur Palhares', 'Hiron Mendes'];
  shoppings text[] := array[
    'Shopping Ibirapuera', 'Center Norte', 'Morumbi Town', 'Pátio Paulista',
    'BarraShopping', 'Rio Sul', 'Norte Shopping', 'Boulevard Rio',
    'BH Shopping', 'Diamond Mall', 'Pátio Savassi', 'Minas Shopping',
    'Flamboyant', 'Passeio das Águas', 'Goiânia Shopping', 'Portal Sul',
    'ParkShopping', 'Conjunto Nacional', 'Taguatinga Shopping', 'Iguatemi Brasília',
    'Salvador Shopping', 'Shopping Barra', 'Pátio Batel', 'Park Shopping Barigui',
    'Iguatemi Porto Alegre', 'BarraShoppingSul', 'Manauara Shopping', 'RioMar Recife',
    'Iguatemi Fortaleza', 'Shopping Recife', 'Amazonas Shopping', 'Natal Shopping'
  ];
  cidades text[] := array[
    'São Paulo', 'São Paulo', 'São Paulo', 'São Paulo',
    'Rio de Janeiro', 'Rio de Janeiro', 'Rio de Janeiro', 'Rio de Janeiro',
    'Belo Horizonte', 'Belo Horizonte', 'Belo Horizonte', 'Belo Horizonte',
    'Goiânia', 'Goiânia', 'Goiânia', 'Goiânia',
    'Brasília', 'Brasília', 'Brasília', 'Brasília',
    'Salvador', 'Salvador', 'Curitiba', 'Curitiba',
    'Porto Alegre', 'Porto Alegre', 'Manaus', 'Recife',
    'Fortaleza', 'Recife', 'Manaus', 'Natal'
  ];
  ufs text[] := array[
    'SP','SP','SP','SP', 'RJ','RJ','RJ','RJ', 'MG','MG','MG','MG',
    'GO','GO','GO','GO', 'DF','DF','DF','DF', 'BA','BA','PR','PR',
    'RS','RS','AM','PE', 'CE','PE','AM','RN'
  ];
  servicos text[] := array[
    'Montagem árvore central', 'Decoração de fachada', 'Iluminação de praça',
    'Túnel de LED', 'Vila do Noel', 'Guirlandas e festões',
    'Presépio', 'Ornamentação de vitrines'
  ];
  montadores uuid[];

  v_projeto_id uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_inicio date;
  v_fim date;
  v_gestor text;
  v_perfil int;                -- 0 adiantado · 1 em linha · 2 atrasado · 3 crítico
  v_os_inicio date;
  v_os_fim date;
  v_dur int;
  v_fracao_planejada numeric;
  v_limite_aprovadas numeric;
  v_status text;
  v_status_val text;
  v_validado timestamptz;
  v_os_id uuid;
  i int;
  j int;
  total_os int := 8;
begin
  select array_agg(id order by codigo_acesso)
    into montadores
    from usuarios
   where perfil = 'montador' and codigo_acesso like 'M000%';

  for i in 1..80 loop
    v_gestor := gestores[1 + ((i - 1) % 5)];
    v_perfil := case
      when i % 10 = 0 then 3            -- 8 projetos críticos
      when i % 5 = 0 then 2             -- 8 atrasados
      when i % 3 = 0 then 0             -- ~26 adiantados
      else 1                            -- restante em linha
    end;

    -- cronograma: começou entre 45 e 15 dias atrás, termina entre 20 e 90 dias à frente
    v_inicio := v_hoje - (15 + (i * 7) % 31);
    v_fim    := v_hoje + (20 + (i * 11) % 71);

    insert into projetos (cliente, shopping, cidade, uf, temporada, status, data_inicio, data_fim, responsavel_comercial)
    values (
      'TESTE ' || shoppings[1 + ((i - 1) % 32)] || ' ' || lpad(i::text, 2, '0'),
      shoppings[1 + ((i - 1) % 32)],
      cidades[1 + ((i - 1) % 32)],
      ufs[1 + ((i - 1) % 32)],
      '2026',
      'em_montagem',
      v_inicio,
      v_fim,
      v_gestor
    )
    returning id into v_projeto_id;

    -- fração do cronograma decorrida até hoje
    v_fracao_planejada := least(1, greatest(0,
      (v_hoje - v_inicio)::numeric / nullif((v_fim - v_inicio), 0)::numeric));

    -- quantas OSs deveriam estar aprovadas por perfil
    v_limite_aprovadas := round(v_fracao_planejada * total_os * case v_perfil
      when 0 then 1.15   -- adiantado
      when 1 then 0.95   -- em linha
      when 2 then 0.65   -- atrasado
      else 0.30          -- crítico
    end);

    for j in 1..total_os loop
      -- janelas sequenciais cobrindo o período do projeto
      v_os_inicio := v_inicio + ((j - 1) * (v_fim - v_inicio) / total_os);
      v_os_fim    := v_inicio + (j * (v_fim - v_inicio) / total_os) - 1;
      v_dur := greatest(1, v_os_fim - v_os_inicio + 1);

      if j <= v_limite_aprovadas then
        v_status := 'concluida';
        v_status_val := 'aprovada';
        -- aprovações espalhadas: as antigas perto do término previsto,
        -- a mais recente dentro das últimas 24-72h (gera avanço 24h e ritmo)
        if j = v_limite_aprovadas::int and v_perfil in (0, 1) then
          v_validado := now() - ((i % 20) || ' hours')::interval;
        else
          v_validado := least(now() - interval '1 hour',
            (v_os_fim::timestamptz + interval '1 day') + ((i % 3) || ' days')::interval);
        end if;
      elsif j = v_limite_aprovadas::int + 1 and v_perfil <> 3 then
        v_status := 'aguardando_validacao';
        v_status_val := null;
        v_validado := null;
      elsif j = v_limite_aprovadas::int + 1 and v_perfil = 3 then
        v_status := 'em_andamento';
        v_status_val := 'ajuste_solicitado';   -- crítico: OS devolvida
        v_validado := now() - interval '5 days';
      elsif j = v_limite_aprovadas::int + 2 then
        v_status := 'em_andamento';
        v_status_val := null;
        v_validado := null;
      else
        v_status := 'pendente';
        v_status_val := null;
        v_validado := null;
      end if;

      insert into ordens_servico (
        projeto_id, codigo_os, codigo_cronograma, local, servico, equipe,
        status, progresso, inicio_previsto, termino_previsto,
        status_validacao, validado_em, iniciado_em, concluido_em
      ) values (
        v_projeto_id,
        'OS-' || lpad(i::text, 2, '0') || '-' || j,
        ((j + 1) / 2)::text || '.' || (1 + (j + 1) % 2)::text,
        'Praça central - setor ' || j,
        servicos[1 + ((j - 1) % 8)],
        'Equipe ' || chr(64 + 1 + (i % 3)),
        v_status,
        case when v_status_val = 'aprovada' then 100
             when v_status = 'aguardando_validacao' then 100
             when v_status = 'em_andamento' then 40 + (i % 40)
             else 0 end,
        v_os_inicio,
        v_os_fim,
        v_status_val,
        v_validado,
        case when v_status <> 'pendente' then v_os_inicio::timestamptz + interval '9 hours' end,
        case when v_status in ('concluida', 'aguardando_validacao')
             then v_os_fim::timestamptz + interval '20 hours' end
      );
    end loop;

    -- vincula 3 montadores por projeto (rotação)
    insert into projeto_usuarios (projeto_id, usuario_id, funcao)
    select v_projeto_id, montadores[1 + ((i + k) % 6)], 'montador'
      from generate_series(0, 2) as k
    on conflict do nothing;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4. REATIVA OS GATILHOS E CONFERE
-- ------------------------------------------------------------
set session_replication_role = origin;

select responsavel_comercial as gestor,
       count(*) as projetos
  from projetos
 group by 1 order by 2 desc;

select status, status_validacao, count(*)
  from ordens_servico
 group by 1, 2 order by 3 desc;
