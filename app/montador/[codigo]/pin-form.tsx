"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

function formatDate(date: string | null) {
  if (!date) return "Não informado";

  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

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

    const { data, error } = await supabase.rpc("listar_projetos_montador", {
      p_usuario_id: usuarioId,
    });

    if (error) {
      setErro(error.message);
      setProjetos([]);
      setCarregandoProjetos(false);
      return;
    }

    setProjetos((data ?? []) as ProjetoMontador[]);
    setCarregandoProjetos(false);
  }

  useEffect(() => {
    const storage = sessionStorage.getItem("fdl_montador");

    if (!storage) return;

    try {
      const dados = JSON.parse(storage);

      if (dados?.codigo?.toUpperCase() !== codigo.toUpperCase()) {
        sessionStorage.removeItem("fdl_montador");
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
      sessionStorage.removeItem("fdl_montador");
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

    sessionStorage.setItem(
      "fdl_montador",
      JSON.stringify({
        usuarioId: montadorValidado.usuario_id,
        nome: montadorValidado.nome,
        codigo: montadorValidado.codigo_montador,
      })
    );

    setMontador(montadorValidado);
    await carregarProjetos(montadorValidado.usuario_id);

    setLoading(false);
  }

  if (montador) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-green-400/30 bg-green-500/10 p-5">
          <p className="text-sm uppercase tracking-[0.22em] text-green-200">
            Acesso liberado
          </p>

          <h2 className="mt-3 text-2xl font-bold text-white">
            Olá, {montador.nome}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/65">
            Seu acesso de campo foi validado com sucesso.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
              Meus projetos
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Projetos vinculados
            </h3>

            <p className="mt-1 text-sm text-white/55">
              Selecione um projeto para acompanhar as OSs de montagem.
            </p>
          </div>

          {carregandoProjetos ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/60">
              Carregando projetos...
            </div>
          ) : projetos.length > 0 ? (
            <div className="space-y-4">
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
                  <article
                    key={projeto.projeto_id}
                    className="rounded-3xl border border-white/10 bg-white/[0.05] p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                          Temporada {projeto.temporada ?? "2026"}
                        </p>

                        <h4 className="mt-2 text-xl font-bold text-white">
                          {projeto.cliente || projeto.shopping}
                        </h4>

                        <p className="mt-1 text-sm text-white/55">
                           {projeto.uf}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          projeto.status
                        )}`}
                      >
                        {formatStatus(projeto.status)}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-white/45">Período previsto</p>
                        <p className="mt-1 font-semibold text-white">
                          {formatDate(projeto.data_inicio)} até{" "}
                          {formatDate(projeto.data_fim)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-white/45">OSs do projeto</p>
                            <p className="mt-1 font-semibold text-white">
                              {projeto.os_concluidas} de {projeto.total_os}{" "}
                              concluídas
                            </p>
                          </div>

                          <strong className="text-2xl text-[var(--fdl-cream)]">
                            {progresso}%
                          </strong>
                        </div>

                        <div className="mt-3 h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-[var(--fdl-cream)]"
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <a
  href={`/montador/${codigo}/projetos/${projeto.projeto_id}`}
  className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
>
  Abrir OSs do projeto
</a>
                  </article>
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

        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("fdl_montador");
            setMontador(null);
            setProjetos([]);
            setPin("");
          }}
          className="h-12 w-full rounded-2xl border border-white/15 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Trocar montador
        </button>
      </div>
    );
  }

  return (
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
  );
}