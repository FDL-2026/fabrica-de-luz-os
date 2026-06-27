import Image from "next/image";
import OsDetalheClient from "./os-detalhe-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    codigo: string;
    projetoId: string;
    osId: string;
  }>;
};

export default async function MontadorOsPage({ params }: PageProps) {
  const { codigo, projetoId, osId } = await params;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8">
        <div className="mb-8 flex justify-center">
          <Image
            src="/brand/H_TAGLINE_SF_ROXO.png"
            alt="Fábrica de Luz"
            width={500}
            height={300}
            priority
            className="h-auto max-h-28 w-full max-w-md object-contain"
          />
        </div>

        <OsDetalheClient codigo={codigo} projetoId={projetoId} osId={osId} />
      </div>
    </main>
  );
}
