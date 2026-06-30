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

function codigoOs(os: OrdemServico) {
  return os.codigo_cronograma || os.codigo_os || "Sem código";
}

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
    <section className="fdl-ui-section fdl-ui-section-warning">
      <div className="fdl-ui-section-head">
        <div>
          <p className="fdl-ui-kicker">Fila de validação</p>
          <h2 className="fdl-ui-section-title">OSs aguardando validação</h2>
          <p className="fdl-ui-section-desc">
            OSs concluídas pelo montador e pendentes de aprovação do gestor.
          </p>
        </div>

        <span className="fdl-ui-badge fdl-ui-badge-yellow">
          {ordensAguardandoValidacao.length} pendente(s)
        </span>
      </div>

      {ordensAguardandoValidacao.length > 0 ? (
        <div className="fdl-ui-table-wrap">
          <div className="fdl-ui-table-scroll">
            <table className="min-w-[900px] fdl-ui-table">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Local</th>
                  <th>Serviço</th>
                  <th>Equipe</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>

              <tbody>
                {ordensAguardandoValidacao.map((os) => (
                  <tr key={os.id}>
                    <td className="fdl-ui-table-primary">{codigoOs(os)}</td>

                    <td className="text-white/74">{os.local || "-"}</td>

                    <td className="text-white/74">{os.servico || "-"}</td>

                    <td className="text-white/74">{os.equipe || "-"}</td>

                    <td className="text-right">
                      <a
                        href={`/projetos/${projetoId}/os/${os.id}/validacao`}
                        className="fdl-ui-btn fdl-ui-btn-sm fdl-ui-btn-primary"
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
        <div className="fdl-ui-empty">
          Nenhuma OS aguardando validação neste projeto.
        </div>
      )}
    </section>
  );
}
