import Image from "next/image";
import PinForm from "./pin-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    codigo: string;
  }>;
};

export default async function MontadorPage({ params }: PageProps) {
  const { codigo } = await params;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <section className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Image
              src="/brand/H_TAGLINE_SF_ROXO.png"
              alt="Fábrica de Luz"
              width={500}
              height={300}
              priority
              className="h-auto max-h-32 w-full object-contain"
            />
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur">
            <div className="mb-7">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-2xl text-[var(--fdl-purple-dark)]">
                🔐
              </div>

              <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
                Acesso do montador
              </p>

              <h1 className="mt-3 text-3xl font-bold">Entrar com PIN</h1>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Digite o PIN vinculado ao código de acesso para liberar o painel
                de campo.
              </p>
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                Código de acesso
              </p>

              <p className="mt-2 text-2xl font-bold text-[var(--fdl-cream)]">
                {codigo.toUpperCase()}
              </p>
            </div>

            <PinForm codigo={codigo} />
          </div>

          <p className="mt-6 text-center text-xs text-white/40">
            Fábrica de Luz · Sistema OS
          </p>
        </section>
      </div>
    </main>
  );
}