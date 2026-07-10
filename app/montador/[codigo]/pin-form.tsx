"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { aquecerListasOs, lerRpcComCache } from "@/lib/offline/cache";
import { prefetchTelasMontador } from "@/lib/offline/prefetch";
import ChamadosAlertaMontador from "@/components/montador/chamados-alerta-montador";

type PinFormProps = {
  codigo: string;
};

type MontadorValidado = {
  usuario_id: string;
  nome: string;
  perfil: string;
  codigo_montador: string;
};

type ProjetoMontador = {
  projeto_id: string;
  cliente: string | null;
  shopping: string | null;
  cidade: string | null;
  uf: string | null;
  temporada: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  funcao: string | null;
  total_os: number;
  os_concluidas: number;
  os_pendentes: number;
};


function formatStatus(status: string | null) {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    em_montagem: "Em montagem",
    pausado: "Pausado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    pendente: "Pendente",
    concluida: "Concluída",
  };

  return labels[status] ?? status.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_montagem":
      return "bg-green-100 text-green-700";

    case "planejamento":
      return "bg-blue-100 text-blue-700";

    case "pausado":
    case "pendente":
      return "bg-yellow-100 text-yellow-700";

    case "concluido":
    case "concluida":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";

    case "cancelado":
      return "bg-red-100 text-red-700";

    default:
      return "bg-white/20 text-white";
  }
}

export default function PinForm({ codigo }: PinFormProps) {
  const supabase = createClient();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [montador, setMontador] = useState<MontadorValidado | null>(null);
  const [projetos, setProjetos] = useState<ProjetoMontador[]>([]);
  const [carregandoProjetos, setCarregandoProjetos] = useState(false);

  async function carregarProjetos(usuarioId: string) {
    setCarregandoProjetos(true);

    const { data, error } = await lerRpcComCache<ProjetoMontador>(
      supabase,
      "listar_projetos_montador",
      {
        p_usuario_id: usuarioId,
      }
    );

    if (error) {
      setErro(error);
      setProjetos([]);
      setCarregandoProjetos(false);
      return;
    }

    const lista = data ?? [];
    setProjetos(lista);
    setCarregandoProjetos(false);

    // Pré-carrega os shells das telas de cada projeto para uso offline.
    prefetchTelasMontador(
      lista.map(
        (p) => `/montador/${codigo}/projetos/${p.projeto_id}`
      )
    );

    // Aquece a lista de OSs de cada projeto (cobre a página do projeto e as
    // telas de etapas), para abrirem offline mesmo sem visita prévia.
    aquecerListasOs(
      supabase,
      usuarioId,
      lista.map((p) => p.projeto_id)
    );
  }

  useEffect(() => {
    const storage = localStorage.getItem("fdl_montador");

    if (!storage) return;

    try {
      const dados = JSON.parse(storage);

      const sessaoExpirada =
        typeof dados?.expiraEm === "number" && dados.expiraEm < Date.now();

      if (sessaoExpirada || dados?.codigo?.toUpperCase() !== codigo.toUpperCase()) {
        localStorage.removeItem("fdl_montador");
        return;
      }

      const montadorSalvo: MontadorValidado = {
        usuario_id: dados.usuarioId,
        nome: dados.nome,
        perfil: "montador",
        codigo_montador: dados.codigo,
      };

      setMontador(montadorSalvo);
      carregarProjetos(dados.usuarioId);
    } catch {
      localStorage.removeItem("fdl_montador");
    }
  }, [codigo]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErro("");

    const pinLimpo = pin.trim();

    if (!pinLimpo) {
      setErro("Digite o PIN para continuar.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("validar_pin_montador", {
      p_codigo: codigo,
      p_pin: pinLimpo,
    });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    const resultado = Array.isArray(data) ? data[0] : null;

    if (!resultado) {
      setErro("Código ou PIN inválido.");
      setLoading(false);
      return;
    }

    const montadorValidado = resultado as MontadorValidado;

    localStorage.setItem(
      "fdl_montador",
      JSON.stringify({
        usuarioId: montadorValidado.usuario_id,
        nome: montadorValidado.nome,
        codigo: montadorValidado.codigo_montador,
        expiraEm: Date.now() + 12 * 60 * 60 * 1000,
      })
    );

    setMontador(montadorValidado);
    await carregarProjetos(montadorValidado.usuario_id);

    setLoading(false);
  }

  if (montador) {
    const sair = () => {
      localStorage.removeItem("fdl_montador");
      setMontador(null);
      setProjetos([]);
      setPin("");
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="fdl-mobile-kicker">Painel de campo</p>
            <h2 className="truncate text-2xl font-bold text-white">
              Olá, {montador.nome}
            </h2>
          </div>
          <button
            type="button"
            onClick={sair}
            className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Trocar
          </button>
        </div>

        <ChamadosAlertaMontador
          usuarioId={montador.usuario_id}
          codigo={codigo}
        />

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--fdl-cream)]">
              Meus projetos
            </h3>
            {projetos.length > 0 ? (
              <span className="text-xs font-semibold text-white/45">
                {projetos.length} vinculado{projetos.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          {carregandoProjetos ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/60">
              Carregando projetos...
            </div>
          ) : projetos.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {projetos.map((projeto) => {
                const progresso =
                  projeto.total_os > 0
                    ? Math.round(
                        (Number(projeto.os_concluidas) /
                          Number(projeto.total_os)) *
                          100
                      )
                    : 0;

                return (
                  <a
                    key={projeto.projeto_id}
                    href={`/montador/${codigo}/projetos/${projeto.projeto_id}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="truncate text-base font-bold text-white">
                          {projeto.cliente || projeto.shopping}
                        </h4>
                        <p className="mt-0.5 text-xs text-white/50">
                          {projeto.uf} · Temporada {projeto.temporada ?? "2026"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                          projeto.status
                        )}`}
                      >
                        {formatStatus(projeto.status)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-white/10">
                        <div
                          className="fdl-bar-fill h-1.5 rounded-full"
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-bold text-[var(--fdl-cream)]">
                        {progresso}%
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-white/45">
                      {projeto.os_concluidas}/{projeto.total_os} OSs concluídas
                    </p>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
              <p className="font-semibold text-white">
                Nenhum projeto vinculado.
              </p>

              <p className="mt-2 text-sm text-white/55">
                Peça para o gestor vincular seu usuário a um projeto.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="fdl-mobile-card fdl-mobile-card-strong">
      <div className="mb-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-2xl text-[var(--fdl-purple-dark)]">
          🔐
        </div>

        <p className="fdl-mobile-kicker">Acesso do montador</p>

        <h1 className="fdl-mobile-title">Entrar com PIN</h1>

        <p className="fdl-mobile-description">
          Digite o PIN vinculado ao código de acesso para liberar o painel de
          campo.
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
          Código de acesso
        </p>

        <p className="mt-2 text-2xl font-extrabold tracking-wide text-[var(--fdl-cream)]">
          {codigo.toUpperCase()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="pin"
            className="mb-2 block text-sm font-medium text-white/80"
          >
            PIN de acesso
          </label>

        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="Digite seu PIN"
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-center text-xl tracking-[0.35em] text-white outline-none transition placeholder:text-sm placeholder:tracking-normal placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
        />
      </div>

      {erro ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {erro}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Validando..." : "Liberar acesso"}
      </button>
      </form>
    </section>
  );
}