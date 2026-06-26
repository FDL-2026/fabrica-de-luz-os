import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(date: string | null) {
  if (!date) return "Não informado";

  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatStatus(status: string | null) {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    em_montagem: "Em montagem",
    pausado: "Pausado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    prevista: "Prevista",
    em_andamento: "Em andamento",
    concluida: "Concluída",
    atrasada: "Atrasada",
    pendente: "Pendente",
    bloqueada: "Bloqueada",
  };

  return labels[status] ?? status.replace("_", " ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "em_montagem":
    case "em_andamento":
      return "bg-green-100 text-green-700";
    case "planejamento":
    case "prevista":
      return "bg-blue-100 text-blue-700";
    case "pausado":
    case "pendente":
      return "bg-yellow-100 text-yellow-700";
    case "concluido":
    case "concluida":
      return "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";
    case "cancelado":
    case "atrasada":
    case "bloqueada":
      return "bg-red-100 text-red-700";
    default:
      return "bg-white/20 text-white";
  }
}

export default async function ProjetoDetalhePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
  redirect(`/login?error=sem_sessao&from=projeto_${id}`);
}

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", user.id)
    .single();

  if (!usuario || !usuario.ativo) {
  redirect(`/login?error=perfil_projeto&from=projeto_${id}`);
}

  const { data: projeto } = await supabase
    .from("projetos")
    .select(
      "id, cliente, shopping, cidade, uf, temporada, status, data_inicio, data_fim, observacoes"
    )
    .eq("id", id)
    .single();

  if (!projeto) {
    notFound();
  }

  const { data: noites } = await supabase
    .from("noites_montagem")
    .select("id, numero_noite, data, horario_inicio, horario_fim, status")
    .eq("projeto_id", id)
    .order("numero_noite", { ascending: true });

  const { data: ordensServico } = await supabase
    .from("ordens_servico")
    .select("id, codigo_os, local, servico, equipe, status, prioridade")
    .eq("projeto_id", id)
    .order("codigo_os", { ascending: true });

  const totalNoites = noites?.length ?? 0;
  const noitesConcluidas =
    noites?.filter((noite) => noite.status === "concluida").length ?? 0;

  const totalOS = ordensServico?.length ?? 0;
  const osConcluidas =
    ordensServico?.filter((os) => os.status === "concluida").length ?? 0;
  const osPendentes =
    ordensServico?.filter((os) => os.status === "pendente").length ?? 0;

  const progresso =
    totalOS > 0 ? Math.round((osConcluidas / totalOS) * 100) : 0;

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
              className="block rounded-2xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Painel geral
            </Link>

            <Link
              href="/projetos"
              className="block rounded-2xl bg-white/15 px-4 py-3 font-semibold text-white"
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

          <Link
            href="/logout"
            className="mt-4 block rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Sair
          </Link>
        </aside>

        <section className="p-8">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href="/projetos"
                className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
              >
                ← Voltar para projetos
              </Link>

              <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Projeto
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {projeto.cliente || projeto.shopping}
              </h1>

              <p className="mt-2 text-sm text-white/60">
                {projeto.cidade} / {projeto.uf} · Temporada {projeto.temporada}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${statusClass(
                  projeto.status
                )}`}
              >
                {formatStatus(projeto.status)}
              </span>

              <Link
                href={`/projetos/${projeto.id}/cronograma`}
                className="rounded-full bg-[var(--fdl-cream)] px-5 py-2 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
              >
                Ver cronograma
              </Link>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Noites previstas</p>
              <strong className="mt-3 block text-4xl">{totalNoites}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                {noitesConcluidas} concluídas
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Total de OSs</p>
              <strong className="mt-3 block text-4xl">{totalOS}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                cadastradas no projeto
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">OSs pendentes</p>
              <strong className="mt-3 block text-4xl">{osPendentes}</strong>
              <span className="mt-2 block text-sm text-yellow-600">
                aguardando execução
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Progresso</p>
              <strong className="mt-3 block text-4xl">{progresso}%</strong>
              <div className="mt-3 h-2 rounded-full bg-[#eee7f4]">
                <div
                  className="h-2 rounded-full bg-[var(--fdl-purple)]"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
          </div>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Dados do projeto</h2>
                <p className="mt-1 text-sm text-white/50">
                  Informações principais do contrato/montagem.
                </p>
              </div>

              <div className="grid gap-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-white/45">Cliente</p>
                  <p className="mt-1 font-semibold">{projeto.cliente}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-white/45">Shopping</p>
                  <p className="mt-1 font-semibold">
                    {projeto.shopping || "Não informado"}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Início previsto</p>
                    <p className="mt-1 font-semibold">
                      {formatDate(projeto.data_inicio)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-white/45">Fim previsto</p>
                    <p className="mt-1 font-semibold">
                      {formatDate(projeto.data_fim)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-white/45">Observações</p>
                  <p className="mt-1 text-white/80">
                    {projeto.observacoes || "Nenhuma observação cadastrada."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Cronograma noite a noite</h2>
                <p className="mt-1 text-sm text-white/50">
                  Visão geral das noites de montagem.
                </p>
              </div>

              <div className="space-y-3">
                {noites && noites.length > 0 ? (
                  noites.map((noite) => (
                    <div
                      key={noite.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold">
                          Noite {String(noite.numero_noite).padStart(2, "0")}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                          {formatDate(noite.data)} ·{" "}
                          {noite.horario_inicio || "--:--"} às{" "}
                          {noite.horario_fim || "--:--"}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          noite.status
                        )}`}
                      >
                        {formatStatus(noite.status)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/50">
                    Nenhuma noite cadastrada ainda.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Ordens de serviço</h2>
                <p className="mt-1 text-sm text-white/50">
                  OSs vinculadas ao projeto.
                </p>
              </div>

              <Link
                href={`/projetos/${projeto.id}/cronograma`}
                className="w-fit rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Abrir cronograma
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-white/10 text-white/70">
                  <tr>
                    <th className="px-4 py-3">OS</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3">Serviço</th>
                    <th className="px-4 py-3">Equipe</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {ordensServico && ordensServico.length > 0 ? (
                    ordensServico.map((os) => (
                      <tr key={os.id} className="border-t border-white/10">
                        <td className="px-4 py-3 font-semibold">
                          {os.codigo_os}
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          {os.local || "Não informado"}
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          {os.servico}
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          {os.equipe || "Não definida"}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                              os.status
                            )}`}
                          >
                            {formatStatus(os.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-white/50"
                      >
                        Nenhuma OS cadastrada ainda.
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