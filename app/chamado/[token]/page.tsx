import ChamadoClient from "../chamado-client";
import ManutencoesPublicas from "./manutencoes-publicas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Abrir chamado de manutenção",
  description:
    "Registre uma solicitação de manutenção para a equipe da Fábrica de Luz.",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ChamadoTokenPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("fdl_obter_projeto_por_token", {
    p_token: token,
  });
  const projeto = Array.isArray(data) && data[0] ? data[0] : null;

  // Histórico dos chamados deste shopping (degrada para vazio se a RPC ainda
  // não existir no banco).
  const { data: histData } = await supabase.rpc(
    "fdl_listar_chamados_projeto_token",
    { p_token: token }
  );
  const historico = Array.isArray(histData) ? histData : [];

  // Manutenções proativas visíveis ao cliente (degrada para vazio se a RPC
  // ainda não existir no banco).
  const { data: manData } = await supabase.rpc("fdl_listar_manutencoes_token", {
    p_token: token,
  });
  const manutencoes = Array.isArray(manData) ? manData : [];

  return (
    <main className="fdl-content min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-lg">
        {projeto ? (
          <>
            <ChamadoClient projetoFixo={projeto} historico={historico} />
            <ManutencoesPublicas token={token} manutencoes={manutencoes} />
          </>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
            <h1 className="text-xl font-bold">Link inválido</h1>
            <p className="mt-3 text-sm text-white/60">
              Não encontramos o shopping deste link. Confira o endereço ou fale
              com o gestor responsável.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
