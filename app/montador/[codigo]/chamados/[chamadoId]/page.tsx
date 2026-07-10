import MontadorShell from "@/components/montador/montador-shell";
import ChamadoDetalheMontadorClient from "./chamado-detalhe-montador-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    codigo: string;
    chamadoId: string;
  }>;
};

export default async function MontadorChamadoPage({ params }: PageProps) {
  const { codigo, chamadoId } = await params;

  return (
    <MontadorShell maxWidth="lg" showFooter={false}>
      <ChamadoDetalheMontadorClient codigo={codigo} chamadoId={chamadoId} />
    </MontadorShell>
  );
}
