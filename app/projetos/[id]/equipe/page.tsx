import Image from "next/image";
import { requireUser } from "@/lib/auth/require-user";
import EquipeProjetoClient from "./equipe-projeto-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EquipeProjetoPage({ params }: PageProps) {
  const { id } = await params;

  await requireUser(`/projetos/${id}/equipe`);

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="fdl-content mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
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

        <EquipeProjetoClient projetoId={id} />
      </div>
    </main>
  );
}
