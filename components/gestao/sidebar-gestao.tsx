"use client";

import { useState } from "react";
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
  const [menuAberto, setMenuAberto] = useState(false);

  function estaAtivo(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Barra superior compacta (mobile) */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--fdl-purple)] lg:hidden">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/brand/SIMBOLO_FDL.png"
              alt="Fábrica de Luz"
              width={314}
              height={314}
              priority
              className="h-9 w-9 object-contain"
            />
            <span className="text-sm font-black tracking-tight text-white">
              Central de Comando
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuAberto((atual) => !atual)}
            aria-expanded={menuAberto}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl border border-white/15 bg-white/5"
          >
            <span
              className={`h-[2px] w-5 rounded-full bg-white transition ${
                menuAberto ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-[2px] w-5 rounded-full bg-white transition ${
                menuAberto ? "opacity-0" : ""
              }`}
            />
            <span
              className={`h-[2px] w-5 rounded-full bg-white transition ${
                menuAberto ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>

        {menuAberto ? (
          <nav className="border-t border-white/10 px-4 pb-4 pt-2 text-sm">
            {itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuAberto(false)}
                aria-current={estaAtivo(item.href) ? "page" : undefined}
                className={
                  estaAtivo(item.href)
                    ? "mt-1 block rounded-2xl bg-white/15 px-4 py-3 font-semibold text-white"
                    : "mt-1 block rounded-2xl px-4 py-3 text-white/70 transition hover:bg-white/10 hover:text-white"
                }
              >
                {item.label}
              </Link>
            ))}

            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{usuarioNome}</p>
                <p className="text-xs text-white/60">
                  {usuarioPerfil.replace("_", " ")}
                </p>
              </div>

              <a
                href="/logout"
                className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80"
              >
                Sair
              </a>
            </div>
          </nav>
        ) : null}
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden border-r border-white/10 bg-[var(--fdl-purple)] p-6 lg:block">
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
    </>
  );
}
