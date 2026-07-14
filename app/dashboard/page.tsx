import { requireUser } from "@/lib/auth/require-user";
import SidebarGestao from "@/components/gestao/sidebar-gestao";
import DashboardClient from "./dashboard-client";
import ChamadosResumoDashboard from "@/components/chamados/resumo-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const { usuario } = await requireUser("/dashboard");

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[264px_1fr]">
        <SidebarGestao
          usuarioNome={usuario.nome}
          usuarioPerfil={usuario.perfil}
        />

        <section className="fdl-content min-w-0 p-4 pb-12 sm:p-6 lg:p-8">
          {usuario.perfil !== "visitante" ? <ChamadosResumoDashboard /> : null}
          <DashboardClient usuarioPerfil={usuario.perfil} />
        </section>
      </div>
    </main>
  );
}
