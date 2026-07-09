import Image from "next/image";
import OsGestaoClient from "./os-gestao-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
    osId: string;
  }>;
};

export default async function OsGestaoPage({ params }: PageProps) {
  const { id, osId } = await params;

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="fdl-content mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
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

        <OsGestaoClient projetoId={id} osId={osId} />
      </div>
    </main>
  );
}
