"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FdlToast from "@/components/ui/fdl-toast";

type EquipeProjetoClientProps = {
  projetoId: string;
};

type UsuarioRpc = {
  usuario_id: string;
  nome: string | null;
  email: string | null;
  perfil: string | null;
  ativo: boolean;
  tipo_login: string | null;
  codigo_acesso: string | null;
  funcao?: string | null;
};

type Montador = {
  usuario_id: string;
  nome: string;
  codigo_acesso: string | null;
  ativo: boolean;
};

export default function EquipeProjetoClient({
  projetoId,
}: EquipeProjetoClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [busca, setBusca] = useState("");
  const [montadores, setMontadores] = useState<Montador[]>([]);
  const [vinculados, setVinculados] = useState<Set<string>>(new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const [gestores, setGestores] = useState<
    { usuario_id: string; nome: string }[]
  >([]);
  const [gestorSel, setGestorSel] = useState("");
  const [gestorAtual, setGestorAtual] = useState("");
  const [salvandoGestor, setSalvandoGestor] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro("");

    const [equipeResult, usuariosResult, gestaoResult] = await Promise.all([
      supabase.rpc("fdl_listar_equipe_projeto", {
        p_projeto_id: projetoId,
      }),
      supabase.rpc("fdl_listar_usuarios_para_vinculo", {
        p_projeto_id: projetoId,
      }),
      supabase.rpc("fdl_listar_usuarios_gestao"),
    ]);

    if (equipeResult.error || usuariosResult.error) {
      setErro(
        equipeResult.error?.message ||
          usuariosResult.error?.message ||
          "Erro ao carregar montadores."
      );
      setMontadores([]);
      setVinculados(new Set());
      setSelecionados(new Set());
      setCarregando(false);
      return;
    }

    const equipeCompleta = (equipeResult.data ?? []) as UsuarioRpc[];

    const equipe = equipeCompleta.filter(
      (usuario) => usuario.perfil === "montador"
    );

    const gestorMembro = equipeCompleta.find(
      (usuario) =>
        usuario.perfil === "gestor_comercial" ||
        usuario.funcao === "gestor_comercial"
    );

    const listaGestores = ((gestaoResult.data ?? []) as UsuarioRpc[])
      .filter((u) => u.perfil === "gestor_comercial" && u.ativo !== false)
      .map((u) => ({
        usuario_id: u.usuario_id,
        nome: u.nome?.trim() || "Sem nome",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    setGestores(listaGestores);
    setGestorAtual(gestorMembro?.usuario_id ?? "");
    setGestorSel(gestorMembro?.usuario_id ?? "");

    const idsEquipe = new Set(equipe.map((usuario) => usuario.usuario_id));

    const disponiveis = ((usuariosResult.data ?? []) as UsuarioRpc[]).filter(
      (usuario) =>
        usuario.perfil === "montador" && !idsEquipe.has(usuario.usuario_id)
    );

    const lista: Montador[] = [...equipe, ...disponiveis]
      .map((usuario) => ({
        usuario_id: usuario.usuario_id,
        nome: usuario.nome?.trim() || "Sem nome",
        codigo_acesso: usuario.codigo_acesso,
        ativo: usuario.ativo,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    setMontadores(lista);
    setVinculados(idsEquipe);
    setSelecionados(new Set(idsEquipe));
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId, supabase]);

  function alternar(usuarioId: string) {
    setSucesso("");
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(usuarioId)) {
        proximo.delete(usuarioId);
      } else {
        proximo.add(usuarioId);
      }
      return proximo;
    });
  }

  const montadoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return montadores;

    return montadores.filter(
      (montador) =>
        montador.nome.toLowerCase().includes(termo) ||
        (montador.codigo_acesso ?? "").toLowerCase().includes(termo)
    );
  }, [montadores, busca]);

  const adicionar = useMemo(
    () => [...selecionados].filter((id) => !vinculados.has(id)),
    [selecionados, vinculados]
  );

  const remover = useMemo(
    () => [...vinculados].filter((id) => !selecionados.has(id)),
    [selecionados, vinculados]
  );

  const houveMudanca = adicionar.length > 0 || remover.length > 0;

  async function salvarGestor() {
    setErro("");
    setSucesso("");
    setSalvandoGestor(true);

    const { error } = await supabase.rpc("fdl_definir_gestor_projeto", {
      p_projeto_id: projetoId,
      p_usuario_id: gestorSel || null,
    });

    if (error) {
      setErro(error.message);
      setSalvandoGestor(false);
      return;
    }

    setSucesso("Gestor comercial atualizado.");
    await carregar();
    setSalvandoGestor(false);
  }

  async function salvar() {
    setErro("");
    setSucesso("");
    setSalvando(true);

    for (const usuarioId of adicionar) {
      const { error } = await supabase.rpc("fdl_adicionar_usuario_projeto", {
        p_projeto_id: projetoId,
        p_usuario_id: usuarioId,
        p_funcao: "montador",
      });

      if (error) {
        setErro(error.message);
        setSalvando(false);
        return;
      }
    }

    for (const usuarioId of remover) {
      const { error } = await supabase.rpc("fdl_remover_usuario_projeto", {
        p_projeto_id: projetoId,
        p_usuario_id: usuarioId,
      });

      if (error) {
        setErro(error.message);
        setSalvando(false);
        return;
      }
    }

    setSucesso("Equipe de montagem atualizada com sucesso.");

    await carregar();

    setSalvando(false);
  }

  return (
    <div className="space-y-6">
      <header className="fdl-form-card p-6">
        <a
          href={`/projetos/${projetoId}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para o projeto
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Equipe de Montagem
        </p>

        <h1 className="mt-2 text-3xl font-bold">Montadores do projeto</h1>

        <p className="mt-2 text-sm text-white/60">
          Selecione os montadores que farão parte deste projeto. Somente
          usuários com perfil montador aparecem nesta lista.
        </p>
      </header>

      <section className="fdl-form-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Gestor Comercial</h2>
          <p className="mt-1 text-sm text-white/55">
            Responsável comercial do projeto. Cronogramas por mundos não trazem
            gestor — defina aqui.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="fdl-ui-label">Gestor</label>
            <select
              className="fdl-select mt-2 w-full"
              value={gestorSel}
              onChange={(event) => setGestorSel(event.target.value)}
            >
              <option value="">Sem gestor</option>
              {gestores.map((gestor) => (
                <option key={gestor.usuario_id} value={gestor.usuario_id}>
                  {gestor.nome}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={salvarGestor}
            disabled={salvandoGestor || gestorSel === gestorAtual}
            className="h-11 rounded-2xl bg-[var(--fdl-cream)] px-6 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvandoGestor ? "Salvando..." : "Salvar gestor"}
          </button>
        </div>

        {gestores.length === 0 ? (
          <p className="mt-3 text-xs text-yellow-100/80">
            Nenhum gestor comercial disponível para você. Cadastre em Usuários.
          </p>
        ) : null}
      </section>

      <section className="fdl-form-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--fdl-cream)] px-4 py-1.5 text-sm font-semibold text-[var(--fdl-purple-dark)]">
              👷 {selecionados.size}{" "}
              {selecionados.size === 1 ? "selecionado" : "selecionados"}
            </span>

            {houveMudanca ? (
              <span className="rounded-full bg-yellow-100 px-4 py-1.5 text-sm font-semibold text-yellow-700">
                Alterações não salvas
              </span>
            ) : null}
          </div>

          <div className="w-full md:w-72">
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar montador..."
              className="fdl-field"
            />
          </div>
        </div>

        {erro ? (
          <div className="fdl-ui-alert fdl-ui-alert-error mt-4">{erro}</div>
        ) : null}

        <FdlToast mensagem={sucesso} onFechar={() => setSucesso("")} />

        <div className="mt-5">
          {carregando ? (
            <div className="fdl-empty-state">Carregando montadores...</div>
          ) : montadoresFiltrados.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {montadoresFiltrados.map((montador) => {
                const marcado = selecionados.has(montador.usuario_id);

                return (
                  <label
                    key={montador.usuario_id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                      marcado
                        ? "border-[var(--fdl-cream)] bg-white/10"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={salvando}
                      onChange={() => alternar(montador.usuario_id)}
                      className="h-5 w-5 shrink-0 accent-[var(--fdl-cream)]"
                    />

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {montador.nome}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-white/45">
                        {montador.codigo_acesso
                          ? `Código ${montador.codigo_acesso}`
                          : "Sem código de acesso"}
                        {montador.ativo ? "" : " · Inativo"}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="fdl-empty-state">
              {busca
                ? "Nenhum montador encontrado para esta busca."
                : "Nenhum montador cadastrado no sistema."}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <a
            href={`/projetos/${projetoId}`}
            className="fdl-ui-btn fdl-ui-btn-ghost"
          >
            Cancelar
          </a>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !houveMudanca}
            className="fdl-ui-btn fdl-ui-btn-primary"
          >
            {salvando ? "Salvando..." : "Salvar equipe"}
          </button>
        </div>
      </section>
    </div>
  );
}
