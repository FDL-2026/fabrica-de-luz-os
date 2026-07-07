import { requireUser } from "@/lib/auth/require-user";
import SidebarGestao from "@/components/gestao/sidebar-gestao";
import ImportarClient from "./importar-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImportarPage() {
  const { usuario } = await requireUser("/importar");

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[264px_1fr]">
        <SidebarGestao
          usuarioNome={usuario.nome}
          usuarioPerfil={usuario.perfil}
        />

        <section className="min-w-0 p-4 pb-12 sm:p-6 lg:p-8">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Importação
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Importar cronograma
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                Envie o arquivo padrão de cronograma da Fábrica de Luz para o
                sistema identificar automaticamente projeto, etapas e ordens de
                serviço.
              </p>
            </div>

            <a
              href="/projetos"
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Ver projetos
            </a>
          </header>

          <ImportarClient />
        </section>
      </div>
    </main>
  );
}