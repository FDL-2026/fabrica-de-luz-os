import Image from "next/image";
import { requireUser } from "@/lib/auth/require-user";
import DefinirSenhaForm from "./definir-senha-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DefinirSenhaPage() {
  const { usuario } = await requireUser("/definir-senha", {
    ignorarSenhaProvisoria: true,
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--fdl-purple-dark)] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(108deg,#6a3f97_0%,#4c2c6f_28%,#2b123a_58%,#16051f_100%)]"
      />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Image
              src="/brand/H_TAGLINE_SF_ROXO.png"
              alt="Fábrica de Luz"
              width={500}
              height={300}
              priority
              className="h-auto w-48 object-contain"
            />
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
              Primeiro acesso
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Crie sua nova senha
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Olá{usuario.nome ? `, ${usuario.nome.split(" ")[0]}` : ""}! Por
              segurança, defina uma senha pessoal antes de continuar.
            </p>

            <div className="mt-6">
              <DefinirSenhaForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
