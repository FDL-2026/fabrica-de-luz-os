"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

function traduzirErro(mensagem: string) {
  const normalizada = mensagem.toLowerCase();

  if (normalizada.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (normalizada.includes("email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }

  if (
    normalizada.includes("too many requests") ||
    normalizada.includes("rate limit")
  ) {
    return "Muitas tentativas seguidas. Aguarde alguns instantes e tente de novo.";
  }

  if (normalizada.includes("network") || normalizada.includes("fetch")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  return mensagem;
}

export default function LoginForm({ nextPath }: LoginFormProps) {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErro("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setLoading(false);
      setErro(traduzirErro(error.message));
      return;
    }

    if (!data.user) {
      setLoading(false);
      setErro("Não foi possível iniciar a sessão.");
      return;
    }

    window.location.href = nextPath || "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          E-mail
        </label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu.email@fabricadeluz.com.br"
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-white/80"
          >
            Senha
          </label>

          <a
            href="/auth/forgot-password"
            className="text-xs font-semibold text-[var(--fdl-cream)] hover:underline"
          >
            Esqueci minha senha
          </a>
        </div>

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Digite sua senha"
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none transition placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
        />
      </div>

      {erro ? (
        <div className="fdl-ui-alert fdl-ui-alert-error">{erro}</div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
