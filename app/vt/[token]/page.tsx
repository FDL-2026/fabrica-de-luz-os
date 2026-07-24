import PreencherVistoria from "./preencher-vistoria";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vistoria técnica",
  description: "Preencha o relatório da vistoria técnica no local.",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function VistoriaTokenPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("fdl_obter_vistoria_token", {
    p_token: token,
  });

  const vistoria = data && typeof data === "object" ? data : null;

  return (
    <main className="fdl-content min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-lg">
        {vistoria ? (
          <PreencherVistoria token={token} vistoria={vistoria} />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
            <h1 className="text-xl font-bold">Link inválido</h1>
            <p className="mt-3 text-sm text-white/60">
              Não encontramos esta vistoria. Confira o endereço ou fale com o
              gestor responsável.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
