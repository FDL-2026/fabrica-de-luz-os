import MontadorShell from "@/components/montador/montador-shell";
import OsDetalheClient from "./os-detalhe-client";
import AvisoAjusteMontador from "./aviso-ajuste-montador";

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
    <MontadorShell maxWidth="lg" showFooter={false}>
      <div className="fdl-mobile-stack">
        <AvisoAjusteMontador projetoId={projetoId} osId={osId} />

        <OsDetalheClient codigo={codigo} projetoId={projetoId} osId={osId} />
      </div>
    </MontadorShell>
  );
}
