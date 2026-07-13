import { requireUser } from "@/lib/auth/require-user";
import ValidacaoOsClient from "./validacao-os-client";
import BrandLogo from "@/components/brand-logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
    osId: string;
  }>;
};

export default async function ValidacaoOsPage({ params }: PageProps) {
  const { id, osId } = await params;

  await requireUser(`/projetos/${id}/os/${osId}/validacao`);

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="fdl-content mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-auto max-h-24 w-full max-w-sm object-contain sm:max-h-36 sm:max-w-lg" />
        </div>

        <ValidacaoOsClient projetoId={id} osId={osId} />
      </div>
    </main>
  );
}
