import Image from "next/image";
import OsClient from "./os-client";
import AjustesPendentesMontador from "./ajustes-pendentes-montador";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    codigo: string;
    projetoId: string;
  }>;
};

export default async function MontadorProjetoPage({ params }: PageProps) {
  const { codigo, projetoId } = await params;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
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

        <AjustesPendentesMontador codigo={codigo} projetoId={projetoId} />



        <OsClient codigo={codigo} projetoId={projetoId} />
      </div>
    </main>
  );
}
