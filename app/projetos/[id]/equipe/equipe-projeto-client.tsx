"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EquipeProjetoClientProps = {
  projetoId: string;
};

type UsuarioEquipe = {
  usuario_id: string;
  nome: string | null;
  email: string | null;
  perfil: string | null;
  ativo: boolean;
  tipo_login: string | null;
  codigo_acesso: string | null;
  funcao: string | null;
};

type UsuarioDisponivel = {
  usuario_id: string;
  nome: string | null;
  email: string | null;
  perfil: string | null;
  ativo: boolean;
  tipo_login: string | null;
  codigo_acesso: string | null;
};

const funcoes = [
  { value: "montador", label: "Montador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "gestor_operacoes", label: "Gestor de Operações" },
  { value: "gestor_comercial", label: "Gestor Comercial" },
  { value: "importador", label: "Importador" },
  { value: "visualizacao", label: "Visualização" },
];

const perfis: Record<string, string> = {
  admin: "Admin",
  gerente_geral: "Gerente Geral",
  gestor_contas: "Gestor Comercial",
  gestor_operacoes: "Gestor de Operações",
  gerente_operacoes: "Gerente de Operações",
  operacoes: "Operações",
  supervisor: "Supervisor",
  montador: "Montador",
};

function formatPerfil(perfil: string | null) {
  if (!perfil) return "-";
  return perfis[perfil] ?? perfil.replace("_", " ");
}

function formatFuncao(funcao: string | null) {
  if (!funcao) return "-";

  return (
    funcoes.find((item) => item.value === funcao)?.label ||
    funcao.replace("_", " ")
  );
}

function acessoUsuario(usuario: {
  tipo_login: string | null;
  email: string | null;
  codigo_acesso: string | null;
}) {
  if (usuario.tipo_login === "pin") {
    return usuario.codigo_acesso || "Código não informado";
  }

  return usuario.email || "E-mail não informado";
}

export default function EquipeProjetoClient({
  projetoId,
}: EquipeProjetoClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [equipe, setEquipe] = useState<UsuarioEquipe[]>([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<
    UsuarioDisponivel[]
  >([]);

  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
  const [funcao, setFuncao] = useState("montador");

  async function carregar() {
    setCarregando(true);
    setErro("");

    const [equipeResult, usuariosResult] = await Promise.all([
      supabase.rpc("fdl_listar_equipe_projeto", {
        p_projeto_id: projetoId,
      }),
      supabase.rpc("fdl_listar_usuarios_para_vinculo", {
        p_projeto_id: projetoId,
      }),
    ]);

    if (equipeResult.error) {
      setErro(equipeResult.error.message);
      setEquipe([]);
      setUsuariosDisponiveis([]);
      setCarregando(false);
      return;
    }

    if (usuariosResult.error) {
      setErro(usuariosResult.error.message);
      setEquipe([]);
      setUsuariosDisponiveis([]);
      setCarregando(false);
      return;
    }

    setEquipe((equipeResult.data ?? []) as UsuarioEquipe[]);
    setUsuariosDisponiveis((usuariosResult.data ?? []) as UsuarioDisponivel[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, [projetoId, supabase]);

  async function adicionarUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!usuarioSelecionado) {
      setErro("Selecione um usuário para vincular ao projeto.");
      return;
    }

    setErro("");
    setSucesso("");
    setSalvando(true);

    const { error } = await supabase.rpc("fdl_adicionar_usuario_projeto", {
      p_projeto_id: projetoId,
      p_usuario_id: usuarioSelecionado,
      p_funcao: funcao,
    });

    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    setUsuarioSelecionado("");
    setFuncao("montador");
    setSucesso("Usuário vinculado ao projeto com sucesso.");

    await carregar();

    setSalvando(false);
  }

  async function removerUsuario(usuario: UsuarioEquipe) {
    const confirmar = window.confirm(
      `Remover ${usuario.nome || "este usuário"} deste projeto?`
    );

    if (!confirmar) return;

    setErro("");
    setSucesso("");
    setSalvando(true);

    const { error } = await supabase.rpc("fdl_remover_usuario_projeto", {
      p_projeto_id: projetoId,
      p_usuario_id: usuario.usuario_id,
    });

    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    setSucesso("Usuário removido do projeto.");

    await carregar();

    setSalvando(false);
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <a
          href={`/projetos/${projetoId}`}
          className="text-sm font-semibold text-[var(--fdl-cream)] hover:underline"
        >
          ← Voltar para o projeto
        </a>

        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
          Equipe do projeto
        </p>

        <h1 className="mt-2 text-3xl font-bold">Usuários vinculados</h1>

        <p className="mt-2 text-sm text-white/60">
          Adicione montadores, supervisores e gestores que terão acesso a este
          projeto.
        </p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={adicionarUsuario}
          className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
        >
          <h2 className="text-xl font-bold">Adicionar usuário</h2>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Usuário
              </label>

              <select
                value={usuarioSelecionado}
                onChange={(event) => setUsuarioSelecionado(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
              >
                <option className="text-black" value="">
                  Selecione um usuário
                </option>

                {usuariosDisponiveis.map((usuario) => (
                  <option
                    key={usuario.usuario_id}
                    className="text-black"
                    value={usuario.usuario_id}
                  >
                    {usuario.nome} · {formatPerfil(usuario.perfil)} ·{" "}
                    {acessoUsuario(usuario)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Função no projeto
              </label>

              <select
                value={funcao}
                onChange={(event) => setFuncao(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)]"
              >
                {funcoes.map((item) => (
                  <option key={item.value} className="text-black" value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {erro ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                {erro}
              </div>
            ) : null}

            {sucesso ? (
              <div className="rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-100">
                {sucesso}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={salvando || !usuarioSelecionado}
              className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Adicionar ao projeto"}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Equipe vinculada</h2>
            <p className="mt-1 text-sm text-white/55">
              Usuários que já possuem acesso a este projeto.
            </p>
          </div>

          {carregando ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
              Carregando equipe...
            </div>
          ) : equipe.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-white/10 text-white/70">
                    <tr>
                      <th className="px-4 py-3">Usuário</th>
                      <th className="px-4 py-3">Perfil</th>
                      <th className="px-4 py-3">Função</th>
                      <th className="px-4 py-3">Acesso</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {equipe.map((usuario) => (
                      <tr
                        key={usuario.usuario_id}
                        className="border-t border-white/10"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">
                            {usuario.nome}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {usuario.ativo ? "Ativo" : "Inativo"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-white/75">
                          {formatPerfil(usuario.perfil)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[var(--fdl-lilac)] px-3 py-1 text-xs font-semibold text-[var(--fdl-purple-dark)]">
                            {formatFuncao(usuario.funcao)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-white/60">
                          {acessoUsuario(usuario)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={salvando}
                            onClick={() => removerUsuario(usuario)}
                            className="inline-flex h-8 items-center justify-center rounded-full bg-red-100 px-3 text-xs font-semibold text-red-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/50">
              Nenhum usuário vinculado a este projeto ainda.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
