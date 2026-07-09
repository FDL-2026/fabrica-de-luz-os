"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Antes de montar no cliente, assume o padrão (escuro) para evitar flicker.
  const atual = mounted ? resolvedTheme ?? theme ?? "dark" : "dark";

  const base =
    "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition";
  const ativo = "bg-[var(--fdl-cream)] text-[var(--fdl-purple-dark)]";
  const inativo = "text-white/70 hover:text-white";

  return (
    <div
      className="flex gap-1 rounded-full bg-white/10 p-1"
      role="group"
      aria-label="Tema"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={atual === "light"}
        className={`${base} ${atual === "light" ? ativo : inativo}`}
      >
        <Sun size={14} /> Claro
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={atual === "dark"}
        className={`${base} ${atual === "dark" ? ativo : inativo}`}
      >
        <Moon size={14} /> Escuro
      </button>
    </div>
  );
}
