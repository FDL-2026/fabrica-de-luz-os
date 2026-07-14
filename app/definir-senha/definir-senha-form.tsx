"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DefinirSenhaForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");

    if (senha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }

    setSalvando(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    if (!token) {
      setErro("Sessão expirada. Faça login novamente.");
      setSalvando(false);
      return;
    }

    const response = await fetch("/api/usuarios/definir-senha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ senha }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setErro(payload?.error ?? "Não foi possível definir a nova senha.");
      setSalvando(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  const campoClasse =
    "h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-white">
          Nova senha
        </label>
        <input
          type="password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className={campoClasse}
          placeholder="Mínimo 6 caracteres"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-white">
          Confirmar nova senha
        </label>
        <input
          type="password"
          value={confirmar}
          onChange={(event) => setConfirmar(event.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className={campoClasse}
          placeholder="Repita a nova senha"
        />
      </div>

      {erro ? (
        <div className="fdl-ui-alert fdl-ui-alert-error">{erro}</div>
      ) : null}

      <button
        type="submit"
        disabled={salvando}
        className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Definir senha e continuar"}
      </button>
    </form>
  );
}
