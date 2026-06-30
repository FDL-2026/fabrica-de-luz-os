"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrdemServico = {
  id: string;
  codigo_os: string | null;
  codigo_cronograma?: string | null;
  local: string | null;
  servico: string | null;
  equipe: string | null;
  status: string | null;
};

type FilaValidacaoProjetoClientProps = {
  projetoId: string;
  ordensAguardandoValidacao: OrdemServico[];
};

export default function FilaValidacaoProjetoClient({
  projetoId,
  ordensAguardandoValidacao,
}: FilaValidacaoProjetoClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [podeValidarProjeto, setPodeValidarProjeto] = useState(false);
  const [carregandoPermissao, setCarregandoPermissao] = useState(true);

  useEffect(() => {
    async function carregarPermissaoValidacao() {
      setCarregandoPermissao(true);

      const { data } = await supabase.rpc("fdl_usuario_pode_validar_projeto", {
        p_projeto_id: projetoId,
      });

      setPodeValidarProjeto(Boolean(data));
      setCarregandoPermissao(false);
    }

    carregarPermissaoValidacao();
  }, [projetoId, supabase]);

  if (carregandoPermissao || !podeValidarProjeto) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-yellow-300/30 bg-yellow-300/10 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--fdl-cream)]">
            Fila de validação
          </p>

          <h2 className="mt-2 text-xl font-bold">OSs aguardando validação</h2>

          <p className="mt-1 text-sm text-white/60">
            OSs concluídas pelo montador e pendentes de aprovação do gestor.
          </p>
        </div>

        <span className="w-fit rounded-full bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-700">
          {ordensAguardandoValidacao.length} pendente(s)
        </span>
      </div>

      {ordensAguardandoValidacao.length > 0 ? (
        <div className="mt-5 fdl-table-wrap">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm fdl-data-table">
              <thead className="bg-white/10 text-white/70">
                <tr>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Equipe</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>

              <tbody>
                {ordensAguardandoValidacao.map((os) => (
                  <tr key={os.id} className="border-t border-white/10">
                    <td className="px-4 py-3 font-bold text-white">
                      {os.codigo_cronograma || os.codigo_os || "-"}
                    </td>

                    <td className="px-4 py-3 text-white/75">
                      {os.local || "-"}
                    </td>

                    <td className="px-4 py-3 text-white/75">
                      {os.servico || "-"}
                    </td>

                    <td className="px-4 py-3 text-white/75">
                      {os.equipe || "-"}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <a
                        href={`/projetos/${projetoId}/os/${os.id}/validacao`}
                        className="fdl-btn fdl-btn-sm fdl-btn-primary"
                      >
                        Validar OS
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/55">
          Nenhuma OS aguardando validação neste projeto.
        </div>
      )}
    </section>
  );
}
