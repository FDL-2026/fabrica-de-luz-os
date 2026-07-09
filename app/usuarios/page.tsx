import { requireUser } from "@/lib/auth/require-user";
import SidebarGestao from "@/components/gestao/sidebar-gestao";
import UsuariosClient from "./usuarios-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsuariosPage() {
  const { usuario } = await requireUser("/usuarios");

  return (
    <main className="min-h-screen bg-[var(--fdl-purple-dark)] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[264px_1fr]">
        <SidebarGestao
          usuarioNome={usuario.nome}
          usuarioPerfil={usuario.perfil}
        />

        <section className="fdl-content min-w-0 p-4 pb-12 sm:p-6 lg:p-8">
          <UsuariosClient usuarioPerfil={usuario.perfil} />
        </section>
      </div>
    </main>
  );
}
