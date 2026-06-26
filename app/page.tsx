export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#16051f] text-white flex items-center justify-center px-6">
      <section className="w-full max-w-4xl rounded-3xl border border-purple-900/60 bg-white/5 p-10 shadow-2xl">
        <div className="mb-8">
          <div className="mb-4 text-5xl text-[#d9b56f]">☆</div>

          <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
            Sistema OS
          </p>

          <h1 className="mt-3 text-4xl font-bold text-white">
            Fábrica de Luz
          </h1>

          <p className="mt-3 max-w-2xl text-purple-200">
            Diário de montagem, acompanhamento de cronograma, controle de OSs,
            registros fotográficos e gestão operacional por projeto.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 text-[#231329]">
            <p className="text-sm text-[#7d6488]">Projetos</p>
            <strong className="mt-2 block text-3xl">0</strong>
            <span className="text-sm text-[#7d6488]">em acompanhamento</span>
          </div>

          <div className="rounded-2xl bg-white p-5 text-[#231329]">
            <p className="text-sm text-[#7d6488]">OSs pendentes</p>
            <strong className="mt-2 block text-3xl">0</strong>
            <span className="text-sm text-[#7d6488]">aguardando execução</span>
          </div>

          <div className="rounded-2xl bg-white p-5 text-[#231329]">
            <p className="text-sm text-[#7d6488]">Status</p>
            <strong className="mt-2 block text-3xl">Online</strong>
            <span className="text-sm text-green-600">sistema publicado</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/login"
            className="rounded-xl bg-[#d9b56f] px-5 py-3 font-semibold text-[#16051f] transition hover:opacity-90"
          >
            Acessar sistema
          </a>

          <a
            href="/montador/M1001"
            className="rounded-xl border border-purple-500 px-5 py-3 font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Acesso montador teste
          </a>
        </div>
      </section>
    </main>
  );
}