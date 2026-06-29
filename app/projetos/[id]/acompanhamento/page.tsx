import Image from "next/image";
import AcompanhamentoClient from "./acompanhamento-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AcompanhamentoProjetoPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8">
        <div className="mb-8 flex justify-center">
          <Image
            src="/brand/H_TAGLINE_SF_ROXO.png"
            alt="Fábrica de Luz"
            width={500}
            height={300}
            priority
            className="h-auto max-h-24 w-full max-w-sm object-contain"
          />
        </div>

        <AcompanhamentoClient projetoId={id} />
      </div>
    </main>
  );
}
