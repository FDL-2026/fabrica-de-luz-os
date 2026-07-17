import Image from "next/image";
import Link from "next/link";
import LoginForm from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

const destaques = [
  {
    titulo: "Gestão ativa e sincronizada",
    descricao:
      "Acompanhamento preciso do avanço noturno, do planejamento à execução, sem planilha e sem atraso de informação.",
  },
  {
    titulo: "Auditoria visual integrada",
    descricao:
      "Foto e vídeo enviados do campo validam cada etapa concluída na hora.",
  },
  {
    titulo: "Previsibilidade baseada em dados",
    descricao:
      "Planejado vs. realizado no dia a dia, com previsão de término pelo ritmo real das equipes.",
  },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params?.next ?? "/dashboard";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--fdl-purple-dark)] text-white lg:h-screen">
      {/* Fundo contínuo: um só plano de luz atravessando a tela */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(108deg,#6a3f97_0%,#4c2c6f_28%,#2b123a_58%,#16051f_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(62%_78%_at_14%_16%,rgba(237,224,177,0.16),transparent_60%),radial-gradient(46%_58%_at_88%_92%,rgba(255,255,255,0.05),transparent_58%)]"
      />

      {/* pontos de luz espalhados por toda a superfície */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <span className="absolute left-[8%] top-[16%] h-1.5 w-1.5 rounded-full bg-[var(--fdl-cream)] opacity-70 blur-[1px]" />
        <span className="absolute left-[33%] top-[10%] h-1 w-1 rounded-full bg-white opacity-45 blur-[1px]" />
        <span className="absolute left-[46%] top-[30%] h-2 w-2 rounded-full bg-[var(--fdl-cream)] opacity-30 blur-[2px]" />
        <span className="absolute left-[16%] top-[54%] h-1 w-1 rounded-full bg-white opacity-40 blur-[1px]" />
        <span className="absolute left-[28%] top-[80%] h-1 w-1 rounded-full bg-[var(--fdl-cream)] opacity-45 blur-[1px]" />
        <span className="absolute left-[68%] top-[22%] h-1 w-1 rounded-full bg-white opacity-30 blur-[1px]" />
        <span className="absolute left-[90%] top-[70%] h-1.5 w-1.5 rounded-full bg-[var(--fdl-cream)] opacity-35 blur-[1px]" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-10">
          <div className="relative z-10">
            <Image
              src="/brand/H_TAGLINE_SF_ROXO.png"
              alt="Fábrica de Luz"
              width={500}
              height={300}
              priority
              className="h-auto w-60 object-contain"
            />
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--fdl-cream)]">
              Central de Comando · Temporada 2026
            </p>

            <h1 className="mt-5 text-[2rem] font-black leading-[1.12] tracking-tight xl:text-[2.15rem]">
              Visão executiva e controle absoluto: toda a operação em uma única
              tela.
            </h1>

            <p className="mt-5 max-w-md text-sm leading-7 text-white/70">
              Transformamos o acompanhamento. Monitore a evolução diária,
              valide as entregas das equipes e tenha dados confiáveis para a
              tomada de decisão.
            </p>

            <div className="mt-8 space-y-3">
              {destaques.map((item) => (
                <div
                  key={item.titulo}
                  className="rounded-2xl border border-white/10 border-l-[3px] border-l-[var(--fdl-cream)]/70 bg-white/[0.07] px-5 py-3.5 backdrop-blur"
                >
                  <p className="text-sm font-bold text-white">{item.titulo}</p>
                  <p className="mt-1 text-xs leading-5 text-white/55">
                    {item.descricao}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs font-semibold tracking-wide text-white/40">
            Fábrica de Luz · A engenharia do encanto
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Image
                src="/brand/H_TAGLINE_SF_ROXO.png"
                alt="Fábrica de Luz"
                width={500}
                height={300}
                priority
                className="h-auto w-48 object-contain"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur">
              <div className="mb-8">
                <Image
                  src="/brand/SIMBOLO_FDL.png"
                  alt=""
                  aria-hidden="true"
                  width={321}
                  height={321}
                  className="mb-4 h-14 w-14 object-contain"
                />

                <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                  Central de Comando
                </p>

                <h2 className="mt-3 text-3xl font-semibold text-white">
                  Entrar no sistema
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  Use seu e-mail corporativo e senha para acessar o painel de
                  acompanhamento.
                </p>
              </div>

              <LoginForm nextPath={nextPath} />

              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Montador de campo?
                </p>

                <Link
                  href="/montador"
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--fdl-cream)]/40 bg-[var(--fdl-cream)]/10 text-sm font-semibold text-[var(--fdl-cream)] transition hover:bg-[var(--fdl-cream)] hover:text-[var(--fdl-purple-dark)]"
                >
                  Entrar com Código + PIN
                </Link>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-white/40 lg:hidden">
              Fábrica de Luz · A engenharia do encanto
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
