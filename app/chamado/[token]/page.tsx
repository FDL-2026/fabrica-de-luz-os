import ChamadoClient from "../chamado-client";
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

  return (
    <main className="fdl-content min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-lg">
        {projeto ? (
          <ChamadoClient projetoFixo={projeto} />
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
