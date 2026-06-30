import MontadorShell from "@/components/montador/montador-shell";
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
    <MontadorShell maxWidth="sm" center>
      <section className="fdl-mobile-card fdl-mobile-card-strong">
        <div className="mb-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fdl-cream)] text-2xl text-[var(--fdl-purple-dark)]">
            🔐
          </div>

          <p className="fdl-mobile-kicker">Acesso do montador</p>

          <h1 className="fdl-mobile-title">Entrar com PIN</h1>

          <p className="fdl-mobile-description">
            Digite o PIN vinculado ao código de acesso para liberar o painel de
            campo.
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
            Código de acesso
          </p>

          <p className="mt-2 text-2xl font-black text-[var(--fdl-cream)]">
            {codigo.toUpperCase()}
          </p>
        </div>

        <PinForm codigo={codigo} />
      </section>
    </MontadorShell>
  );
}
