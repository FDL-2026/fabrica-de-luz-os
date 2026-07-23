import { requireUser } from "@/lib/auth/require-user";
import SidebarGestao from "@/components/gestao/sidebar-gestao";
import ManutencoesClient from "./manutencoes-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ManutencoesPage() {
  const { usuario } = await requireUser("/manutencoes", {
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
              Manutenções
            </p>
            <h1 className="mt-2 text-3xl font-bold">Manutenções realizadas</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Reparos registrados pela equipe no local, com foto de antes e
              depois. Já ficam visíveis ao cliente no link do shopping.
            </p>
          </header>

          <ManutencoesClient />
        </section>
      </div>
    </main>
  );
}
