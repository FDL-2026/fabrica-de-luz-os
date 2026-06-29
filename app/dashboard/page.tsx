import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const { usuario } = await requireUser("/dashboard");

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-white/10 bg-[var(--fdl-purple)] p-6">
          <div className="mb-10 flex items-center justify-center rounded-3xl bg-white/5 p-4">
            <Image
              src="/brand/H_TAGLINE_SF_ROXO.png"
              alt="Fábrica de Luz"
              width={500}
              height={300}
              priority
              className="h-auto max-h-28 w-full object-contain"
            />
          </div>

          <nav className="space-y-2 text-sm">
            <Link
              href="/dashboard"
              className="block rounded-2xl bg-white/15 px-4 py-3 font-semibold text-white"
            >
              Painel geral
            </Link>

            <Link
              href="/projetos"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Projetos
            </Link>

            <Link
              href="/usuarios"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Usuários
            </Link>

            <Link
              href="/importar"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Importar cronograma
            </Link>
          </nav>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/10 p-4">
            <p className="text-sm font-semibold">{usuario.nome}</p>
            <p className="mt-1 text-xs text-white/60">
              {usuario.perfil.replace("_", " ")}
            </p>
          </div>

          <a
            href="/logout"
            className="mt-4 block rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Sair
          </a>
        </aside>

        <section className="p-8">
          <DashboardClient />
        </section>
      </div>
    </main>
  );
}
