"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PinFormProps = {
  codigo: string;
};

type MontadorValidado = {
  usuario_id: string;
  nome: string;
  perfil: string;
  codigo_montador: string;
};

export default function PinForm({ codigo }: PinFormProps) {
  const supabase = createClient();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [montador, setMontador] = useState<MontadorValidado | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErro("");

    const pinLimpo = pin.trim();

    if (!pinLimpo) {
      setErro("Digite o PIN para continuar.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("validar_pin_montador", {
      p_codigo: codigo,
      p_pin: pinLimpo,
    });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    const resultado = Array.isArray(data) ? data[0] : null;

    if (!resultado) {
      setErro("Código ou PIN inválido.");
      setLoading(false);
      return;
    }

    const montadorValidado = resultado as MontadorValidado;

    sessionStorage.setItem(
      "fdl_montador",
      JSON.stringify({
        usuarioId: montadorValidado.usuario_id,
        nome: montadorValidado.nome,
        codigo: montadorValidado.codigo_montador,
      })
    );

    setMontador(montadorValidado);
    setLoading(false);
  }

  if (montador) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-green-400/30 bg-green-500/10 p-5">
          <p className="text-sm uppercase tracking-[0.22em] text-green-200">
            Acesso liberado
          </p>

          <h2 className="mt-3 text-2xl font-bold text-white">
            Olá, {montador.nome}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/65">
            Seu acesso de campo foi validado com sucesso.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-semibold text-white">
            Próximas etapas do painel:
          </p>

          <div className="mt-4 space-y-3 text-sm text-white/65">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Ver projetos vinculados ao montador
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Preencher diário de montagem
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Enviar fotos e vídeos da execução
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Concluir ordens de serviço
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("fdl_montador");
            setMontador(null);
            setPin("");
          }}
          className="h-12 w-full rounded-2xl border border-white/15 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Trocar montador
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="pin"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          PIN de acesso
        </label>

        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="Digite seu PIN"
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-center text-xl tracking-[0.35em] text-white outline-none transition placeholder:text-sm placeholder:tracking-normal placeholder:text-white/35 focus:border-[var(--fdl-cream)] focus:ring-4 focus:ring-[var(--fdl-cream)]/10"
        />
      </div>

      {erro ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {erro}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Validando..." : "Liberar acesso"}
      </button>
    </form>
  );
}