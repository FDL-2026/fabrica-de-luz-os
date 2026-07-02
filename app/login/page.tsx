import Image from "next/image";
import Link from "next/link";
import LoginForm from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params?.next ?? "/dashboard";

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[var(--fdl-purple)] lg:flex lg:items-center lg:justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(237,224,177,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_32%)]" />

          <div className="relative z-10 w-full max-w-2xl px-12">
            <Image
              src="/brand/H_TAGLINE_CF_ROXO.png"
              alt="Fábrica de Luz"
              width={917}
              height={540}
              priority
              className="w-full rounded-3xl shadow-2xl"
            />

            <div className="mt-10 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.35em] text-[var(--fdl-cream)]">
                Sistema OS
              </p>

              <h1 className="mt-3 text-3xl font-semibold">
                Diário de montagem e controle operacional
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
                Acompanhe cronogramas, ordens de serviço, registros diários,
                fotos, vídeos e evolução das montagens em tempo real.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Image
                src="/brand/H_TAGLINE_CF_ROXO.png"
                alt="Fábrica de Luz"
                width={917}
                height={540}
                priority
                className="w-full rounded-3xl"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur">
              <div className="mb-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-2xl text-[var(--fdl-purple-dark)]">
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

            <p className="mt-6 text-center text-xs text-white/40">
              Fábrica de Luz · A engenharia do encanto
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}