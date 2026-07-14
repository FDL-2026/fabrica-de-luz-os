"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarPerfil } from "@/lib/perfis";

type Registro = {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  acao: string;
  detalhes: string | null;
  autor_nome: string | null;
  autor_perfil: string | null;
  criado_em: string;
};

const ACAO_LABEL: Record<string, string> = {
  criado: "Criado",
  alterado: "Alterado",
  ativado: "Ativado",
  inativado: "Inativado",
  excluido: "Excluído",
};

function classeAcao(acao: string) {
  switch (acao) {
    case "criado":
      return "bg-green-100 text-green-700";
    case "excluido":
      return "bg-red-100 text-red-700";
    case "inativado":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-[var(--fdl-lilac)] text-[var(--fdl-purple-dark)]";
  }
}

function dataHoraBR(v: string) {
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function HistoricoClient() {
  const supabase = useMemo(() => createClient(), []);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase
      .rpc("fdl_listar_auditoria_usuarios", { p_usuario_id: null })
      .then(({ data, error }) => {
        if (error) {
          setErro(error.message);
          setRegistros([]);
        } else {
          setRegistros((data ?? []) as Registro[]);
        }
        setCarregando(false);
      });
  }, [supabase]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Usuários
        </p>
        <h1 className="mt-1 text-3xl font-bold">Histórico de alterações</h1>
        <p className="mt-2 text-sm text-white/60">
          Quem criou, alterou, ativou/inativou ou excluiu cada usuário.
        </p>
      </header>

      {erro ? (
        <div className="fdl-ui-alert fdl-ui-alert-error">{erro}</div>
      ) : null}

      <section className="fdl-form-card p-6">
        {carregando ? (
          <div className="fdl-empty-state">Carregando histórico...</div>
        ) : registros.length > 0 ? (
          <div className="fdl-ui-table-wrap">
            <div className="fdl-ui-table-scroll">
              <table className="w-full min-w-[760px] fdl-ui-table">
                <thead className="bg-white/10 text-white/70">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Ação</th>
                    <th className="px-4 py-3">Detalhes</th>
                    <th className="px-4 py-3">Autor</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id} className="border-t border-white/10">
                      <td className="px-4 py-3 text-white/60">
                        {dataHoraBR(r.criado_em)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">
                          {r.usuario_nome || "—"}
                        </p>
                        {r.usuario_email ? (
                          <p className="mt-1 text-xs text-white/45">
                            {r.usuario_email}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${classeAcao(
                            r.acao
                          )}`}
                        >
                          {ACAO_LABEL[r.acao] ?? r.acao}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {r.detalhes || "—"}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        <p className="font-semibold text-white">
                          {r.autor_nome || "—"}
                        </p>
                        {r.autor_perfil ? (
                          <p className="mt-1 text-xs text-white/45">
                            {formatarPerfil(r.autor_perfil)}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="fdl-empty-state">
            Nenhum registro de auditoria ainda.
          </div>
        )}
      </section>
    </div>
  );
}
