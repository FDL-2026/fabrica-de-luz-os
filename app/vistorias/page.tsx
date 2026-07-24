import { requireUser } from "@/lib/auth/require-user";
import SidebarGestao from "@/components/gestao/sidebar-gestao";
import VistoriasClient from "./vistorias-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VistoriasPage() {
  const { usuario } = await requireUser("/vistorias", {
    negarPerfis: ["visitante"],
  });

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[264px_1fr]">
        <SidebarGestao
          usuarioNome={usuario.nome}
          usuarioPerfil={usuario.perfil}
        />

        <section className="fdl-content min-w-0 p-4 pb-12 sm:p-6 lg:p-8">
          <header className="mb-8">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
              Vistorias técnicas
            </p>
            <h1 className="mt-2 text-3xl font-bold">Vistorias técnicas (V.T.)</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Pré-monte o relatório com os pontos e o checklist de cada tipo de
              decoração, gere um link para o responsável preencher no local e
              acompanhe as vistorias concluídas.
            </p>
          </header>

          <VistoriasClient />
        </section>
      </div>
    </main>
  );
}
