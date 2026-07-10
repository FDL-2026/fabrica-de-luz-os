import ChamadoClient from "./chamado-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Abrir chamado de manutenção",
  description:
    "Registre uma solicitação de manutenção para a equipe da Fábrica de Luz.",
};

export default function ChamadoPage() {
  return (
    <main className="fdl-content min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-lg">
        <ChamadoClient />
      </div>
    </main>
  );
}
