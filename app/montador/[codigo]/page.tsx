import MontadorShell from "@/components/montador/montador-shell";
import PinForm from "./pin-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    codigo: string;
  }>;
};

export default async function MontadorPage({ params }: PageProps) {
  const { codigo } = await params;

  return (
    <MontadorShell maxWidth="sm">
      <PinForm codigo={codigo} />
    </MontadorShell>
  );
}
