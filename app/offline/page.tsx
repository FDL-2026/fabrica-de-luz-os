import Image from "next/image";

export const metadata = {
  title: "Sem conexão",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--fdl-purple-dark)] p-8 text-center text-white">
      <Image
        src="/brand/H_TAGLINE_SF_ROXO.png"
        alt="Fábrica de Luz"
        width={320}
        height={190}
        priority
        className="h-auto w-full max-w-[220px] object-contain opacity-90"
      />

      <div className="max-w-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--fdl-cream)]">
          Sem conexão
        </p>
        <h1 className="mt-2 text-2xl font-bold">Você está offline</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Não foi possível carregar esta tela. Verifique sua internet e tente
          novamente — o app volta assim que a conexão retornar.
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="h-11 rounded-2xl bg-[var(--fdl-cream)] px-6 text-sm font-semibold leading-[2.75rem] text-[var(--fdl-purple-dark)]"
      >
        Tentar novamente
      </a>
    </main>
  );
}
