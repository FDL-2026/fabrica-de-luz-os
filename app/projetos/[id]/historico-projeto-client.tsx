"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type HistoricoProjetoClientProps = {
  projetoId: string;
};

type RegistroRpc = {
  registro_id: string;
  os_id: string | null;
  codigo_os: string | null;
  tipo_registro: string | null;
  descricao: string | null;
  percentual_execucao: number | null;
  usuario_nome: string | null;
  criado_em: string | null;
  total_arquivos: number;
};

type OsValidacao = {
  id: string;
  codigo_os: string | null;
  codigo_cronograma: string | null;
  status_validacao: string | null;
  validado_em: string | null;
  observacao_validacao: string | null;
};

type Evento = {
  id: string;
  grupo: "execucao" | "validacao";
  badge: string;
  badgeClasse: string;
  titulo: string;
  descricao: string | null;
  autor: string;
  quando: string | null;
};

const LIMITE_INICIAL = 8;

function formatDateTime(date: string | null) {
  if (!date) return "Data não informada";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function badgeRegistro(tipo: string | null) {
  switch (tipo) {
    case "conclusao_os":
      return { label: "Conclusão da OS", classe: "bg-green-100 text-green-700" };
    case "inicio_os":
      return { label: "Início da OS", classe: "bg-blue-100 text-blue-700" };
    case "pendencia":
      return { label: "Pendência", classe: "bg-yellow-100 text-yellow-700" };
    case "anexo":
      return {
        label: "Anexo",
        classe: "bg-[var(--fdl-lilac)] text-[var(--fdl-purple-dark)]",
      };
    case "acompanhamento":
      return { label: "Acompanhamento", classe: "bg-white/15 text-white/80" };
    case "observacao":
      return { label: "Observação", classe: "bg-white/15 text-white/80" };
    default:
      return {
        label: tipo ? tipo.replaceAll("_", " ") : "Registro",
        classe: "bg-white/15 text-white/80",
      };
  }
}

export default function HistoricoProjetoClient({
  projetoId,
}: HistoricoProjetoClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "execucao" | "validacao">(
    "todos"
  );
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      const [dashboardResult, validacoesResult] = await Promise.all([
        supabase.rpc("fdl_dashboard_gestao", {
          p_gestor_comercial: null,
          p_projeto_id: projetoId,
        }),
        supabase
          .from("ordens_servico")
          .select(
            "id, codigo_os, codigo_cronograma, status_validacao, validado_em, observacao_validacao"
          )
          .eq("projeto_id", projetoId)
          .not("validado_em", "is", null),
      ]);

      const lista: Evento[] = [];

      if (dashboardResult.error && validacoesResult.error) {
        setErro(dashboardResult.error.message);
        setEventos([]);
        setCarregando(false);
        return;
      }

      const registros = (dashboardResult.data?.ultimos_registros ??
        []) as RegistroRpc[];

      for (const registro of registros) {
        const badge = badgeRegistro(registro.tipo_registro);

        lista.push({
          id: `registro-${registro.registro_id}`,
          grupo: "execucao",
          badge: badge.label,
          badgeClasse: badge.classe,
          titulo: `OS ${registro.codigo_os || "sem código"}`,
          descricao: registro.descricao,
          autor: registro.usuario_nome || "Usuário não identificado",
          quando: registro.criado_em,
        });
      }

      if (!validacoesResult.error) {
        for (const os of (validacoesResult.data ?? []) as OsValidacao[]) {
          if (!os.validado_em) continue;

          const aprovada = os.status_validacao === "aprovada";

          lista.push({
            id: `validacao-${os.id}-${os.status_validacao}`,
            grupo: "validacao",
            badge: aprovada ? "OS aprovada" : "Ajuste solicitado",
            badgeClasse: aprovada
              ? "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]"
              : "bg-red-100 text-red-700",
            titulo: `OS ${os.codigo_cronograma || os.codigo_os || "sem código"}`,
            descricao: os.observacao_validacao,
            autor: "Gestão",
            quando: os.validado_em,
          });
        }
      }

      lista.sort((a, b) => {
        const dataA = a.quando ? new Date(a.quando).getTime() : 0;
        const dataB = b.quando ? new Date(b.quando).getTime() : 0;
        return dataB - dataA;
      });

      setEventos(lista);
      setCarregando(false);
    }

    carregar();
  }, [projetoId, supabase]);

  const eventosFiltrados = useMemo(() => {
    if (filtro === "todos") return eventos;
    return eventos.filter((evento) => evento.grupo === filtro);
  }, [eventos, filtro]);

  const eventosVisiveis = expandido
    ? eventosFiltrados
    : eventosFiltrados.slice(0, LIMITE_INICIAL);

  const filtros = [
    { value: "todos" as const, label: "Todos" },
    { value: "execucao" as const, label: "Execução" },
    { value: "validacao" as const, label: "Validações" },
  ];

  return (
    <section className="fdl-form-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="fdl-ui-section-title">Histórico do projeto</h2>
          <p className="mt-1 text-sm text-white/50">
            Trilha de auditoria: quem executou, registrou e validou cada OS, e
            quando.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filtros.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFiltro(item.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                filtro === item.value
                  ? "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]"
                  : "border border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {carregando ? (
          <div className="fdl-empty-state">Carregando histórico...</div>
        ) : erro ? (
          <div className="fdl-ui-alert fdl-ui-alert-error">{erro}</div>
        ) : eventosVisiveis.length > 0 ? (
          <div className="space-y-2">
            {eventosVisiveis.map((evento) => (
              <article
                key={evento.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${evento.badgeClasse}`}
                    >
                      {evento.badge}
                    </span>

                    <span className="text-sm font-semibold text-white">
                      {evento.titulo}
                    </span>
                  </div>

                  <p className="text-xs text-white/45">
                    {evento.autor} · {formatDateTime(evento.quando)}
                  </p>
                </div>

                {evento.descricao ? (
                  <p className="mt-2 text-sm leading-5 text-white/65">
                    {evento.descricao}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="fdl-empty-state">
            Nenhum evento registrado neste projeto ainda.
          </div>
        )}

        {!carregando && eventosFiltrados.length > LIMITE_INICIAL ? (
          <button
            type="button"
            onClick={() => setExpandido((atual) => !atual)}
            className="fdl-ui-btn fdl-ui-btn-ghost fdl-ui-btn-sm mt-4 w-full"
          >
            {expandido
              ? "Mostrar menos"
              : `Mostrar todos os ${eventosFiltrados.length} eventos`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
