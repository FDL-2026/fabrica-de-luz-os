import Image from "next/image";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  await connection();
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario || !usuario.ativo) {
    redirect("/login");
  }

  const { data: projetos } = await supabase
    .from("projetos")
    .select("id, cliente, shopping, cidade, uf, temporada, status")
    .limit(6);

  const totalProjetos = projetos?.length ?? 0;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-white/10 bg-[var(--fdl-purple)] p-6">
          <div className="mb-10 rounded-3xl bg-white/5 p-4">
  <Image
    src="/brand/H_TAGLINE_SF_ROXO.png"
    alt="Fábrica de Luz"
    width={500}
    height={260}
    priority
    className="h-auto w-full object-contain"
  />
</div>

          <nav className="space-y-2 text-sm">
            <a
              href="/dashboard"
              className="block rounded-2xl bg-white/15 px-4 py-3 font-semibold text-white"
            >
              Painel geral
            </a>

            <a
              href="/projetos"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Projetos
            </a>

            <a
              href="/usuarios"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Usuários
            </a>

            <a
              href="/importar"
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Importar cronograma
            </a>
          </nav>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/10 p-4">
            <p className="text-sm font-semibold">{usuario.nome}</p>
            <p className="mt-1 text-xs text-white/60">{usuario.perfil}</p>
          </div>

          <a
  href="/logout"
  className="mt-4 block rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
>
  Sair
</a>

        </aside>

        <section className="p-8">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Painel geral
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                Bem-vindo, {usuario.nome}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Acompanhe os projetos, cronogramas e registros de montagem.
              </p>
            </div>

            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/70">
              Temporada 2026
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Projetos visíveis</p>
              <strong className="mt-3 block text-4xl">{totalProjetos}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                conforme seu perfil de acesso
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Perfil</p>
              <strong className="mt-3 block text-3xl capitalize">
                {usuario.perfil.replace("_", " ")}
              </strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                usuário ativo
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Sistema</p>
              <strong className="mt-3 block text-3xl">Online</strong>
              <span className="mt-2 block text-sm text-green-600">
                conectado ao Supabase
              </span>
            </div>
          </div>

          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Projetos recentes</h3>
                <p className="mt-1 text-sm text-white/50">
                  Primeiros dados carregados do banco.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-white/10 text-white/70">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Cidade</th>
                    <th className="px-4 py-3">Temporada</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {projetos && projetos.length > 0 ? (
                    projetos.map((projeto) => (
                      <tr key={projeto.id} className="border-t border-white/10">
                        <td className="px-4 py-3">
                          {projeto.cliente || projeto.shopping}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {projeto.cidade} / {projeto.uf}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {projeto.temporada}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[var(--fdl-cream)] px-3 py-1 text-xs font-semibold text-[var(--fdl-purple-dark)]">
                            {projeto.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-white/50"
                      >
                        Nenhum projeto encontrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}