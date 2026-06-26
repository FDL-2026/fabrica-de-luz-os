import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
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
                  ☆
                </div>

                <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                  Acesso interno
                </p>

                <h2 className="mt-3 text-3xl font-semibold text-white">
                  Entrar no sistema
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  Use seu e-mail corporativo e senha para acessar o painel de
                  acompanhamento.
                </p>
              </div>

              <form action="/login/submit" method="post" className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-white/80"
                  >
                    E-mail
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="seu.email@fabricadeluz.com.br"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-white/80"
                  >
                    Senha
                  </label>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="Digite sua senha"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
                  />
                </div>

                <button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
                >
                  Entrar
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-white/65">Montador de campo?</p>

                <Link
                  href="/montador/M1001"
                  className="mt-2 inline-flex text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
                >
                  Acessar com PIN
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