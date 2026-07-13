import { Suspense } from "react";
import AcompanharClient from "./acompanhar-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Acompanhar chamado",
  description: "Acompanhe o andamento de um chamado de manutenção pelo protocolo.",
};

export default function AcompanharPage() {
  return (
    <main className="fdl-content min-h-screen bg-[var(--fdl-purple-dark)] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-lg">
        <Suspense fallback={null}>
          <AcompanharClient />
        </Suspense>
      </div>
    </main>
  );
}
