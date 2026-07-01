import MontadorShell from "@/components/montador/montador-shell";
import OsMaesClient from "./os-maes-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    codigo: string;
    projetoId: string;
    filtro: string;
  }>;
};

export default async function OsMaesPage({ params }: PageProps) {
  const { codigo, projetoId, filtro } = await params;

  return (
    <MontadorShell maxWidth="xl" showFooter={false}>
      <OsMaesClient codigo={codigo} projetoId={projetoId} filtro={filtro} />
    </MontadorShell>
  );
}
