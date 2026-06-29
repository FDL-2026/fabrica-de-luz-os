"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MontadorValidado = {
  usuario_id: string;
  nome: string;
  perfil: string;
  codigo_montador: string;
};

export default function MontadorLoginClient() {
  const supabase = createClient();

  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function acessarMontador(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setCarregando(true);

    const codigoTratado = codigo.trim().toUpperCase();
    const pinTratado = pin.trim();

    if (!codigoTratado || !pinTratado) {
      setErro("Informe o código de acesso e o PIN.");
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase.rpc("validar_pin_montador", {
      p_codigo: codigoTratado,
      p_pin: pinTratado,
    });

    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }

    const resultado = Array.isArray(data)
      ? (data[0] as MontadorValidado | undefined)
      : undefined;

    if (!resultado) {
      setErro("Código ou PIN inválido.");
      setCarregando(false);
      return;
    }

    sessionStorage.setItem(
      "fdl_montador",
      JSON.stringify({
        usuarioId: resultado.usuario_id,
        nome: resultado.nome,
        perfil: resultado.perfil,
        codigo: resultado.codigo_montador,
      })
    );

    window.location.href = `/montador/${resultado.codigo_montador}`;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
      <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
        Acesso do montador
      </p>

      <h1 className="mt-2 text-3xl font-bold">Entrar na montagem</h1>

      <p className="mt-2 text-sm text-white/60">
        Informe o código de acesso e o PIN cadastrados no sistema.
      </p>

      <form onSubmit={acessarMontador} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Código de acesso
          </label>

          <input
            value={codigo}
            onChange={(event) => setCodigo(event.target.value.toUpperCase())}
            placeholder="Exemplo: M0002"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            PIN
          </label>

          <input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            inputMode="numeric"
            placeholder="Digite o PIN"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
          />
        </div>

        {erro ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {erro}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={carregando}
          className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {carregando ? "Validando..." : "Acessar projetos"}
        </button>
      </form>

      <a
        href="/login"
        className="mt-5 block text-center text-sm font-semibold text-white/60 hover:text-white"
      >
        Entrar como gestor/admin
      </a>
    </section>
  );
}
