import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";

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

function formatTime(time: string | null) {
  if (!time) return "--h";

  const [hour, minute] = time.split(":");

  if (minute === "00") {
    return `${hour}h`;
  }

  return `${hour}h${minute}`;
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

export default async function CronogramaProjetoPage({ params }: PageProps) {
  const { id } = await params;

  const { supabase, usuario } = await requireUser(
    `/projetos/${id}/cronograma`
  );

  const { data: projeto } = await supabase
    .from("projetos")
    .select(
      "id, cliente, shopping, cidade, uf, temporada, status, data_inicio, data_fim"
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
  const totalOS = ordensServico?.length ?? 0;

  const noitesConcluidas =
    noites?.filter((noite) => noite.status === "concluida").length ?? 0;

  const osConcluidas =
    ordensServico?.filter((os) => os.status === "concluida").length ?? 0;

  const progressoNoites =
    totalNoites > 0 ? Math.round((noitesConcluidas / totalNoites) * 100) : 0;

  const progressoOS =
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
              <a
                href={`/projetos/${projeto.id}`}
                className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
              >
                ← Voltar para o projeto
              </a>

              <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Cronograma de montagem
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {projeto.cliente || projeto.shopping}
              </h1>

              <p className="mt-2 text-sm text-white/60">
                {projeto.cidade} / {projeto.uf} · Temporada {projeto.temporada}
              </p>
            </div>

            <a
              href={`/projetos/${projeto.id}`}
              className="rounded-full bg-[var(--fdl-cream)] px-5 py-2 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
            >
              Ver resumo do projeto
            </a>
          </header>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Noites</p>
              <strong className="mt-3 block text-4xl">{totalNoites}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                total previsto
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Noites concluídas</p>
              <strong className="mt-3 block text-4xl">
                {noitesConcluidas}
              </strong>
              <span className="mt-2 block text-sm text-green-600">
                {progressoNoites}% do cronograma
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">OSs</p>
              <strong className="mt-3 block text-4xl">{totalOS}</strong>
              <span className="mt-2 block text-sm text-[#7d6488]">
                vinculadas ao projeto
              </span>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-6 text-[var(--fdl-text-dark)] shadow-xl">
              <p className="text-sm text-[#7d6488]">Execução de OSs</p>
              <strong className="mt-3 block text-4xl">{progressoOS}%</strong>
              <div className="mt-3 h-2 rounded-full bg-[#eee7f4]">
                <div
                  className="h-2 rounded-full bg-[var(--fdl-purple)]"
                  style={{ width: `${progressoOS}%` }}
                />
              </div>
            </div>
          </div>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Noites de montagem</h2>
                <p className="mt-1 text-sm text-white/50">
                  Sequência operacional prevista para execução.
                </p>
              </div>

              <div className="space-y-3">
                {noites && noites.length > 0 ? (
                  noites.map((noite) => (
                    <article
                      key={noite.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold">
                            Noite {String(noite.numero_noite).padStart(2, "0")}
                          </p>

                          <p className="mt-1 text-sm text-white/50">
                            {formatDate(noite.data)} ·{" "}
                            {formatTime(noite.horario_inicio)} às{" "}
                            {formatTime(noite.horario_fim)}
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
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/50">
                    Nenhuma noite cadastrada ainda.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Ordens de serviço</h2>
                <p className="mt-1 text-sm text-white/50">
                  Lista operacional das OSs previstas no projeto.
                </p>
              </div>

              <div className="space-y-3">
                {ordensServico && ordensServico.length > 0 ? (
                  ordensServico.map((os) => (
                    <article
                      key={os.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{os.codigo_os}</p>

                          <p className="mt-1 text-sm text-white/70">
                            {os.servico}
                          </p>

                          <p className="mt-2 text-xs text-white/45">
                            Local: {os.local || "Não informado"} · Equipe:{" "}
                            {os.equipe || "Não definida"}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            os.status
                          )}`}
                        >
                          {formatStatus(os.status)}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/50">
                    Nenhuma OS cadastrada ainda.
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}