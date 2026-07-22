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

    // Troca a senha pela sessão do próprio usuário — assim a sessão continua
    // válida (a troca via admin invalidaria o login e cairia na tela de login).
    const { error: senhaError } = await supabase.auth.updateUser({
      password: senha,
    });

    if (senhaError) {
      setErro(senhaError.message || "Não foi possível definir a nova senha.");
      setSalvando(false);
      return;
    }

    // Limpa a flag de senha provisória (precisa de privilégio elevado).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    if (token) {
      await fetch("/api/usuarios/definir-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null);
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
        className="fdl-mobile-btn fdl-mobile-btn-primary"
      >
        {salvando ? "Salvando..." : "Definir senha e continuar"}
      </button>
    </form>
  );
}
