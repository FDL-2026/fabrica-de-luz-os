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
    icone: "🗓",
    titulo: "Cronogramas e OSs",
    descricao: "Importados da planilha, acompanhados noite a noite",
  },
  {
    icone: "📷",
    titulo: "Execução comprovada",
    descricao: "Montadores registram fotos e vídeos de cada etapa",
  },
  {
    icone: "📊",
    titulo: "Relatório executivo",
    descricao: "Planejado x real e previsão de término, todo dia",
  },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params?.next ?? "/dashboard";

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[var(--fdl-purple)] lg:flex lg:flex-col lg:justify-between lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(237,224,177,0.20),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_34%)]" />

          {/* pontos de luz */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <span className="absolute left-[12%] top-[18%] h-1.5 w-1.5 rounded-full bg-[var(--fdl-cream)] opacity-70 blur-[1px]" />
            <span className="absolute left-[78%] top-[12%] h-1 w-1 rounded-full bg-white opacity-50 blur-[1px]" />
            <span className="absolute left-[64%] top-[34%] h-2 w-2 rounded-full bg-[var(--fdl-cream)] opacity-40 blur-[2px]" />
            <span className="absolute left-[22%] top-[58%] h-1 w-1 rounded-full bg-white opacity-40 blur-[1px]" />
            <span className="absolute left-[86%] top-[64%] h-1.5 w-1.5 rounded-full bg-[var(--fdl-cream)] opacity-60 blur-[1px]" />
            <span className="absolute left-[40%] top-[82%] h-1 w-1 rounded-full bg-white opacity-35 blur-[1px]" />
          </div>

          <div className="relative z-10">
            <Image
              src="/brand/H_TAGLINE_SF_ROXO.png"
              alt="Fábrica de Luz"
              width={500}
              height={300}
              priority
              className="h-auto w-56 object-contain"
            />
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--fdl-cream)]">
              Central de Comando · Temporada 2026
            </p>

            <h1 className="mt-4 text-4xl font-black leading-[1.15] tracking-tight">
              Toda a operação de Natal em um só painel.
            </h1>

            <p className="mt-4 text-sm leading-7 text-white/70">
              Do desembarque no shopping à aprovação final: projetos,
              cronogramas, ordens de serviço e evolução validada em tempo real.
            </p>

            <div className="mt-8 space-y-3">
              {destaques.map((item) => (
                <div
                  key={item.titulo}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fdl-cream)]/15 text-lg"
                  >
                    {item.icone}
                  </span>

                  <div>
                    <p className="text-sm font-bold text-white">
                      {item.titulo}
                    </p>
                    <p className="text-xs text-white/55">{item.descricao}</p>
                  </div>
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
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--fdl-cream)] to-[#d9c485] text-2xl text-[var(--fdl-purple-dark)] shadow-lg shadow-[var(--fdl-cream)]/10">
                  ✦
                </div>

                <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                  Acesso da gestão
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
                  🔐 Entrar com Código + PIN
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
