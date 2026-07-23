import MontadorShell from "@/components/montador/montador-shell";
import OsClient from "./os-client";
import AjustesPendentesMontador from "./ajustes-pendentes-montador";
import RegistrarManutencaoMontador from "@/components/montador/registrar-manutencao-montador";

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
    <MontadorShell maxWidth="xl" showFooter={false}>
      <div className="fdl-mobile-stack">
        <AjustesPendentesMontador codigo={codigo} projetoId={projetoId} />

        <RegistrarManutencaoMontador codigo={codigo} projetoId={projetoId} />

        <OsClient codigo={codigo} projetoId={projetoId} />
      </div>
    </MontadorShell>
  );
}
