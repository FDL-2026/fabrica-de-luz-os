"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarGestaoProps = {
  usuarioNome: string;
  usuarioPerfil: string;
};

const itens = [
  { href: "/dashboard", label: "Painel geral" },
  { href: "/projetos", label: "Projetos" },
  { href: "/usuarios", label: "Usuários" },
  { href: "/importar", label: "Importar cronograma" },
  { href: "/relatorios/diario", label: "Relatório diário" },
];

export default function SidebarGestao({
  usuarioNome,
  usuarioPerfil,
}: SidebarGestaoProps) {
  const pathname = usePathname();

  function estaAtivo(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="border-r border-white/10 bg-[var(--fdl-purple)] p-6">
      <div className="mb-10 flex items-center justify-center rounded-3xl bg-white/5 p-4">
        <Image
          src="/brand/H_TAGLINE_SF_ROXO.png"
          alt="Fábrica de Luz"
          width={500}
          height={300}
          priority
          className="h-auto max-h-28 w-full object-contain"
        />
      </div>

      <nav className="space-y-2 text-sm">
        {itens.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={estaAtivo(item.href) ? "page" : undefined}
            className={
              estaAtivo(item.href)
                ? "block rounded-2xl bg-white/15 px-4 py-3 font-semibold text-white"
                : "block rounded-2xl px-4 py-3 text-white/70 transition hover:bg-white/10 hover:text-white"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-10 rounded-3xl border border-white/10 bg-white/10 p-4">
        <p className="text-sm font-semibold">{usuarioNome}</p>
        <p className="mt-1 text-xs text-white/60">
          {usuarioPerfil.replace("_", " ")}
        </p>
      </div>

      <a
        href="/logout"
        className="mt-4 block rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Sair
      </a>
    </aside>
  );
}
