import Image from "next/image";
import { requireUser } from "@/lib/auth/require-user";
import BotaoImprimir from "./botao-imprimir";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    todos?: string;
  }>;
};

type ProjetoRow = {
  id: string;
  cliente: string | null;
  shopping: string | null;
  uf: string | null;
  temporada: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  responsavel_comercial?: string | null;
};

type OsRow = {
  id: string;
  projeto_id: string;
  status: string | null;
  status_validacao: string | null;
  validado_em: string | null;
  inicio_previsto: string | null;
  termino_previsto: string | null;
};

type ProgressoRpcRow = {
  projeto_id: string;
  progresso_validado: number | string | null;
  total_dias_ponderados: number | string | null;
};

type ProjetoRelatorio = {
  id: string;
  nome: string;
  uf: string;
  gestor: string;
  planejado: number;
  real: number;
  desvio: number;
  avanco24h: number;
  previsaoTermino: Date | null;
  atrasoProjetadoDias: number | null;
  dataFim: Date | null;
  ajustesSolicitados: number;
  diasSemAvanco: number | null;
  classificacao: "critico" | "atencao" | "ok";
  avisos: string[];
};

const DIA_MS = 86400000;
const JANELA_RITMO_DIAS = 7;
const LIMITE_LINHAS_PADRAO = 18;

function toNumber(value: unknown) {
  const numero = Number(value ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function dataSP(instante: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(instante);
}

function diaUTC(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`);
}

function formatDataCurta(date: Date | null) {
  if (!date) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function formatPontos(value: number) {
  const arredondado = Math.round(value * 10) / 10;
  return arredondado.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default async function RelatorioDiarioPage({ searchParams }: PageProps) {
  const { todos } = await searchParams;
  const mostrarTodos = todos === "1";

  const { supabase } = await requireUser("/relatorios/diario");

  let projetosResult = await supabase
    .from("projetos")
    .select(
      "id, cliente, shopping, uf, temporada, status, data_inicio, data_fim, responsavel_comercial"
    );

  if (projetosResult.error) {
    projetosResult = await supabase
      .from("projetos")
      .select("id, cliente, shopping, uf, temporada, status, data_inicio, data_fim");
  }

  const projetos = ((projetosResult.data ?? []) as ProjetoRow[]).filter(
    (projeto) => projeto.status !== "concluido" && projeto.status !== "cancelado"
  );

  let historicoDisponivel = true;

  let osResult = await supabase
    .from("ordens_servico")
    .select(
      "id, projeto_id, status, status_validacao, validado_em, inicio_previsto, termino_previsto"
    );

  if (osResult.error) {
    historicoDisponivel = false;

    osResult = await supabase
      .from("ordens_servico")
      .select("id, projeto_id, status, inicio_previsto, termino_previsto");
  }

  const ordens = (osResult.data ?? []) as OsRow[];

  const projetoIds = projetos.map((projeto) => projeto.id);

  const progressoOficial: Record<string, number> = {};

  if (projetoIds.length > 0) {
    const { data: progressoData } = await supabase.rpc(
      "fdl_listar_progresso_ponderado_projetos",
      { p_projeto_ids: projetoIds }
    );

    for (const item of (progressoData ?? []) as ProgressoRpcRow[]) {
      progressoOficial[String(item.projeto_id)] = toNumber(
        item.progresso_validado
      );
    }
  }

  const agora = new Date();
  const hojeStr = dataSP(agora);
  const hoje = diaUTC(hojeStr);
  const inicioJanelaRitmo = new Date(
    hoje.getTime() - JANELA_RITMO_DIAS * DIA_MS
  );

  const osPorProjeto = new Map<string, OsRow[]>();

  for (const os of ordens) {
    const lista = osPorProjeto.get(os.projeto_id) ?? [];
    lista.push(os);
    osPorProjeto.set(os.projeto_id, lista);
  }

  const relatorio: ProjetoRelatorio[] = [];

  for (const projeto of projetos) {
    const osProjeto = osPorProjeto.get(projeto.id) ?? [];

    if (osProjeto.length === 0) continue;

    let pesoTotal = 0;
    let pesoPlanejadoHoje = 0;
    let pesoAprovado = 0;
    let pesoAprovadoAteOntem = 0;
    let pesoAprovadoJanela = 0;
    let ajustesSolicitados = 0;
    let ultimaAprovacao: Date | null = null;

    for (const os of osProjeto) {
      if (os.status_validacao === "ajuste_solicitado") {
        ajustesSolicitados += 1;
      }

      if (!os.inicio_previsto || !os.termino_previsto) continue;

      const inicio = diaUTC(os.inicio_previsto);
      const termino = diaUTC(os.termino_previsto);
      const duracao = Math.max(
        1,
        Math.round((termino.getTime() - inicio.getTime()) / DIA_MS) + 1
      );

      pesoTotal += duracao;

      const diasDecorridos =
        Math.floor((hoje.getTime() - inicio.getTime()) / DIA_MS) + 1;
      pesoPlanejadoHoje += clamp(diasDecorridos / duracao, 0, 1) * duracao;

      const aprovada =
        os.status_validacao === "aprovada" ||
        (!historicoDisponivel && os.status === "concluida");

      if (aprovada) {
        pesoAprovado += duracao;

        if (os.validado_em) {
          const validadoDia = diaUTC(dataSP(new Date(os.validado_em)));

          if (!ultimaAprovacao || validadoDia > ultimaAprovacao) {
            ultimaAprovacao = validadoDia;
          }

          if (validadoDia < hoje) {
            pesoAprovadoAteOntem += duracao;
          }

          if (validadoDia > inicioJanelaRitmo) {
            pesoAprovadoJanela += duracao;
          }
        } else {
          pesoAprovadoAteOntem += duracao;
        }
      }
    }

    if (pesoTotal === 0) continue;

    const realCalculado = (pesoAprovado / pesoTotal) * 100;
    const real = progressoOficial[projeto.id] ?? realCalculado;
    const planejado = (pesoPlanejadoHoje / pesoTotal) * 100;
    const desvio = planejado - real;
    const avanco24h = historicoDisponivel
      ? ((pesoAprovado - pesoAprovadoAteOntem) / pesoTotal) * 100
      : 0;

    const ritmoDiario = historicoDisponivel
      ? (pesoAprovadoJanela / pesoTotal) * 100 / JANELA_RITMO_DIAS
      : 0;

    const faltante = Math.max(0, 100 - real);

    let previsaoTermino: Date | null = null;

    if (faltante <= 0.01) {
      previsaoTermino = hoje;
    } else if (ritmoDiario > 0.05) {
      previsaoTermino = new Date(
        hoje.getTime() + Math.ceil(faltante / ritmoDiario) * DIA_MS
      );
    }

    const dataFim = projeto.data_fim ? diaUTC(projeto.data_fim) : null;

    const atrasoProjetadoDias =
      previsaoTermino && dataFim
        ? Math.round((previsaoTermino.getTime() - dataFim.getTime()) / DIA_MS)
        : null;

    const diasSemAvanco =
      historicoDisponivel && ultimaAprovacao
        ? Math.floor((hoje.getTime() - ultimaAprovacao.getTime()) / DIA_MS)
        : null;

    const emExecucao = planejado > 0.5 && faltante > 0.01;

    let classificacao: ProjetoRelatorio["classificacao"] = "ok";

    if (desvio >= 20 || (atrasoProjetadoDias ?? 0) > 7) {
      classificacao = "critico";
    } else if (desvio >= 10 || (atrasoProjetadoDias ?? 0) > 0) {
      classificacao = "atencao";
    }

    const avisos: string[] = [];

    if (desvio >= 10) {
      avisos.push(
        `Real ${formatPontos(real)}% vs planejado ${formatPontos(
          planejado
        )}% (${formatPontos(desvio)} p.p. atrás)`
      );
    }

    if ((atrasoProjetadoDias ?? 0) > 0 && previsaoTermino) {
      avisos.push(
        `No ritmo atual, término em ${formatDataCurta(
          previsaoTermino
        )} (${atrasoProjetadoDias} dia(s) após o prazo)`
      );
    }

    if (emExecucao && ritmoDiario <= 0.05 && historicoDisponivel) {
      avisos.push("Sem ritmo de aprovação nos últimos 7 dias");
    }

    if (emExecucao && (diasSemAvanco ?? 0) >= 3) {
      avisos.push(`Sem OS aprovada há ${diasSemAvanco} dia(s)`);
    }

    if (ajustesSolicitados > 0) {
      avisos.push(`${ajustesSolicitados} OS(s) com ajuste solicitado`);
    }

    relatorio.push({
      id: projeto.id,
      nome: projeto.cliente || projeto.shopping || "Projeto sem nome",
      uf: projeto.uf || "—",
      gestor: projeto.responsavel_comercial || "—",
      planejado,
      real,
      desvio,
      avanco24h,
      previsaoTermino,
      atrasoProjetadoDias,
      dataFim,
      ajustesSolicitados,
      diasSemAvanco,
      classificacao,
      avisos,
    });
  }

  const ordemClassificacao = { critico: 0, atencao: 1, ok: 2 };

  relatorio.sort((a, b) => {
    const porClasse =
      ordemClassificacao[a.classificacao] - ordemClassificacao[b.classificacao];
    if (porClasse !== 0) return porClasse;
    return b.desvio - a.desvio;
  });

  const pesoTotalGeral = relatorio.length;
  const mediaReal =
    pesoTotalGeral > 0
      ? relatorio.reduce((soma, item) => soma + item.real, 0) / pesoTotalGeral
      : 0;
  const mediaPlanejado =
    pesoTotalGeral > 0
      ? relatorio.reduce((soma, item) => soma + item.planejado, 0) /
        pesoTotalGeral
      : 0;
  const avancoMedio24h =
    pesoTotalGeral > 0
      ? relatorio.reduce((soma, item) => soma + item.avanco24h, 0) /
        pesoTotalGeral
      : 0;

  const criticos = relatorio.filter((item) => item.classificacao === "critico");
  const atencao = relatorio.filter((item) => item.classificacao === "atencao");
  const noPrazo = relatorio.filter((item) => item.classificacao === "ok");

  const avisosCriticos = [...criticos, ...atencao]
    .filter((item) => item.avisos.length > 0)
    .slice(0, 8);

  const linhasTabela = mostrarTodos
    ? relatorio
    : relatorio.slice(0, LIMITE_LINHAS_PADRAO);

  const projetosOcultos = relatorio.length - linhasTabela.length;

  const dataRelatorio = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  const horaRelatorio = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  function chipClassificacao(classificacao: ProjetoRelatorio["classificacao"]) {
    switch (classificacao) {
      case "critico":
        return "bg-red-100 text-red-700";
      case "atencao":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-green-100 text-green-700";
    }
  }

  function labelClassificacao(
    classificacao: ProjetoRelatorio["classificacao"]
  ) {
    switch (classificacao) {
      case "critico":
        return "Crítico";
      case "atencao":
        return "Atenção";
      default:
        return "No prazo";
    }
  }

  return (
    <main className="fdl-report-backdrop">
      <div className="fdl-report-toolbar fdl-no-print">
        <a
          href="/dashboard"
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para o painel
        </a>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={mostrarTodos ? "/relatorios/diario" : "/relatorios/diario?todos=1"}
            className="fdl-ui-btn fdl-ui-btn-ghost"
          >
            {mostrarTodos ? "Modo one page" : "Listar todos os projetos"}
          </a>

          <BotaoImprimir />
        </div>
      </div>

      <div className="fdl-report-sheet">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[var(--fdl-purple)] pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--fdl-purple)]">
              Fábrica de Luz · Central de Comando
            </p>

            <h1 className="mt-1 text-2xl font-black text-[var(--fdl-text-dark)]">
              Relatório Diário de Projetos
            </h1>

            <p className="mt-1 text-xs font-semibold capitalize text-[#7d6488]">
              {dataRelatorio} · gerado às {horaRelatorio}
            </p>
          </div>

          <Image
            src="/brand/H_TAGLINE_SF_ROXO.png"
            alt="Fábrica de Luz"
            width={300}
            height={180}
            className="h-auto w-32 object-contain"
          />
        </header>

        <section className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-[#e8e0f0] bg-[#faf7fd] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7d6488]">
              Projetos ativos
            </p>
            <strong className="mt-1 block text-2xl font-black text-[var(--fdl-text-dark)]">
              {relatorio.length}
            </strong>
            <p className="mt-0.5 text-[10px] font-semibold text-[#7d6488]">
              {criticos.length} crítico(s) · {atencao.length} em atenção ·{" "}
              {noPrazo.length} no prazo
            </p>
          </div>

          <div className="rounded-xl border border-[#e8e0f0] bg-[#faf7fd] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7d6488]">
              Planejado x Real (média)
            </p>
            <strong className="mt-1 block text-2xl font-black text-[var(--fdl-text-dark)]">
              {formatPontos(mediaPlanejado)}%{" "}
              <span className="text-base font-bold text-[#7d6488]">vs</span>{" "}
              {formatPontos(mediaReal)}%
            </strong>
            <p className="mt-0.5 text-[10px] font-semibold text-[#7d6488]">
              desvio médio de {formatPontos(mediaPlanejado - mediaReal)} p.p.
            </p>
          </div>

          <div className="rounded-xl border border-[#e8e0f0] bg-[#faf7fd] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7d6488]">
              Avanço nas últimas 24h
            </p>
            <strong className="mt-1 block text-2xl font-black text-[var(--fdl-text-dark)]">
              +{formatPontos(avancoMedio24h)} p.p.
            </strong>
            <p className="mt-0.5 text-[10px] font-semibold text-[#7d6488]">
              média por projeto (OSs aprovadas)
            </p>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              criticos.length > 0
                ? "border-red-200 bg-red-50"
                : "border-green-200 bg-green-50"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7d6488]">
              Projetos críticos
            </p>
            <strong
              className={`mt-1 block text-2xl font-black ${
                criticos.length > 0 ? "text-red-700" : "text-green-700"
              }`}
            >
              {criticos.length}
            </strong>
            <p className="mt-0.5 text-[10px] font-semibold text-[#7d6488]">
              exigem ação imediata da operação
            </p>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-red-700">
            ⚠ Avisos críticos
          </h2>

          {avisosCriticos.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {avisosCriticos.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border-l-4 py-1.5 pl-3 pr-2 text-[11px] leading-snug ${
                    item.classificacao === "critico"
                      ? "border-red-500 bg-red-50"
                      : "border-yellow-500 bg-yellow-50"
                  }`}
                >
                  <strong className="font-black text-[var(--fdl-text-dark)]">
                    {item.nome} ({item.uf}):
                  </strong>{" "}
                  <span className="text-[#4b3a56]">
                    {item.avisos.join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] font-semibold text-green-700">
              Nenhum projeto em avanço crítico hoje. Operação dentro do
              planejado.
            </p>
          )}
        </section>

        <section className="mt-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-[var(--fdl-purple)]">
            Evolução por projeto
          </h2>

          <table className="mt-2 w-full border-collapse text-[10.5px] leading-tight">
            <thead>
              <tr className="border-b-2 border-[var(--fdl-purple)] text-left text-[9px] font-black uppercase tracking-wider text-[#7d6488]">
                <th className="py-1.5 pr-2">Projeto</th>
                <th className="px-2 py-1.5 text-center">Planejado</th>
                <th className="px-2 py-1.5 text-center">Real</th>
                <th className="px-2 py-1.5 text-center">Desvio</th>
                <th className="px-2 py-1.5 text-center">24h</th>
                <th className="px-2 py-1.5 text-center">Prazo</th>
                <th className="px-2 py-1.5 text-center">Previsão</th>
                <th className="py-1.5 pl-2 text-right">Situação</th>
              </tr>
            </thead>

            <tbody>
              {linhasTabela.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[#efe9f5] text-[var(--fdl-text-dark)]"
                >
                  <td className="max-w-[220px] py-1.5 pr-2">
                    <p className="truncate font-bold">{item.nome}</p>
                    <p className="text-[9px] font-semibold text-[#9c88ab]">
                      {item.uf} · {item.gestor}
                    </p>
                  </td>

                  <td className="px-2 py-1.5 text-center font-semibold">
                    {formatPontos(item.planejado)}%
                  </td>

                  <td className="px-2 py-1.5 text-center">
                    <div className="mx-auto w-16">
                      <p className="font-black">{formatPontos(item.real)}%</p>
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[#eee7f4]">
                        <div
                          className="h-full rounded-full bg-[var(--fdl-purple)]"
                          style={{
                            width: `${clamp(item.real, 0, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td
                    className={`px-2 py-1.5 text-center font-black ${
                      item.desvio >= 10
                        ? "text-red-600"
                        : item.desvio <= -5
                          ? "text-green-600"
                          : "text-[#7d6488]"
                    }`}
                  >
                    {item.desvio > 0 ? "-" : "+"}
                    {formatPontos(Math.abs(item.desvio))}
                  </td>

                  <td
                    className={`px-2 py-1.5 text-center font-bold ${
                      item.avanco24h > 0 ? "text-green-600" : "text-[#b3a3c0]"
                    }`}
                  >
                    {item.avanco24h > 0
                      ? `+${formatPontos(item.avanco24h)}`
                      : "0"}
                  </td>

                  <td className="px-2 py-1.5 text-center font-semibold">
                    {formatDataCurta(item.dataFim)}
                  </td>

                  <td
                    className={`px-2 py-1.5 text-center font-bold ${
                      (item.atrasoProjetadoDias ?? 0) > 0
                        ? "text-red-600"
                        : "text-[var(--fdl-text-dark)]"
                    }`}
                  >
                    {formatDataCurta(item.previsaoTermino)}
                  </td>

                  <td className="py-1.5 pl-2 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${chipClassificacao(
                        item.classificacao
                      )}`}
                    >
                      {labelClassificacao(item.classificacao)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {projetosOcultos > 0 ? (
            <p className="mt-2 rounded-lg bg-[#faf7fd] px-3 py-1.5 text-[10px] font-semibold text-[#7d6488]">
              + {projetosOcultos} projeto(s) no prazo não listados (progresso
              médio de {formatPontos(mediaReal)}%). Use &quot;Listar todos os
              projetos&quot; para o relatório completo.
            </p>
          ) : null}
        </section>

        <footer className="mt-4 border-t border-[#e8e0f0] pt-2 text-[9px] leading-snug text-[#9c88ab]">
          <p>
            <strong>Metodologia:</strong> progresso real considera apenas OSs
            aprovadas pela gestão, ponderadas pela duração planejada. Planejado
            = evolução esperada do cronograma até hoje. Previsão de término
            projetada pelo ritmo de aprovação dos últimos {JANELA_RITMO_DIAS}{" "}
            dias.
            {!historicoDisponivel
              ? " Avanço diário indisponível: histórico de validação não encontrado."
              : ""}
          </p>
        </footer>
      </div>
    </main>
  );
}
