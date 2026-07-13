"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Usuario = {
  usuario_id: string;
  nome: string | null;
  email: string | null;
  perfil: string | null;
  ativo: boolean;
  tipo_login: string | null;
  codigo_acesso: string | null;
  ultimo_acesso_pin: string | null;
  criado_em: string | null;
};

type UsuariosClientProps = {
  usuarioPerfil: string;
};

const perfis = [
  { value: "admin", label: "Admin" },
  { value: "diretor", label: "Diretor" },
  { value: "gestor_comercial", label: "Gestor Comercial" },
  { value: "gerente_operacional", label: "Gerente Operacional" },
  { value: "montador", label: "Montador" },
];

function formatPerfil(perfil: string | null) {
  return perfis.find((item) => item.value === perfil)?.label || perfil || "-";
}

function formatDateTime(date: string | null) {
  if (!date) return "Sem registro";

  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function gerarCodigoMontador(totalUsuarios: number) {
  const numero = String(totalUsuarios + 1).padStart(4, "0");
  return `M${numero}`;
}

export default function UsuariosClient({ usuarioPerfil }: UsuariosClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const podeGerenciarTodosPerfis = ["admin", "diretor", "gerente_operacional"].includes(usuarioPerfil);
  const perfisPermitidos = podeGerenciarTodosPerfis
    ? perfis
    : perfis.filter((item) => item.value === "montador");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  const [tipoLogin, setTipoLogin] = useState(() => podeGerenciarTodosPerfis ? "email" : "pin");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState(() => podeGerenciarTodosPerfis ? "gerente_operacional" : "montador");
  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [pin, setPin] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const edicaoRef = useRef<HTMLElement | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSenha, setEditSenha] = useState("");
  const [editPerfil, setEditPerfil] = useState(() => podeGerenciarTodosPerfis ? "gerente_operacional" : "montador");
  const [editTipoLogin, setEditTipoLogin] = useState(() => podeGerenciarTodosPerfis ? "email" : "pin");
  const [editCodigoAcesso, setEditCodigoAcesso] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);

  async function carregarUsuarios() {
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase.rpc("fdl_listar_usuarios_gestao");

    if (error) {
      setErro(error.message);
      setUsuarios([]);
      setCarregando(false);
      return;
    }

    setUsuarios((data ?? []) as Usuario[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregarUsuarios();
  }, [supabase]);

  function alterarTipoLogin(value: string) {
    setTipoLogin(value);

    if (value === "pin") {
      setPerfil("montador");
      setEmail("");
      setSenha("");
      setCodigoAcesso((atual) => atual || gerarCodigoMontador(usuarios.length));
    }

    if (value === "email") {
      setPerfil(podeGerenciarTodosPerfis ? "gerente_operacional" : "montador");
      setCodigoAcesso("");
      setPin("");
    }
  }

  function alterarTipoLoginEdicao(value: string) {
    setEditTipoLogin(value);

    if (value === "pin") {
      setEditPerfil("montador");
      setEditEmail("");
      setEditSenha("");
      setEditCodigoAcesso(
        (atual) => atual || gerarCodigoMontador(usuarios.length)
      );
    }

    if (value === "email") {
      setEditCodigoAcesso("");
      setEditPin("");
      if (editPerfil === "montador") {
        setEditPerfil(podeGerenciarTodosPerfis ? "gerente_operacional" : "montador");
      }
    }
  }

  function abrirEdicao(usuario: Usuario) {
    setErro("");
    setSucesso("");
    setUsuarioEditando(usuario);
    setEditNome(usuario.nome ?? "");
    setEditEmail(usuario.email ?? "");
    setEditSenha("");
    setEditPerfil(usuario.perfil ?? "gestor_operacoes");
    setEditTipoLogin(usuario.tipo_login ?? "email");
    setEditCodigoAcesso(usuario.codigo_acesso ?? "");
    setEditPin("");
    setEditAtivo(Boolean(usuario.ativo));

    // Rola até o formulário de edição (renderiza no topo da tela)
    requestAnimationFrame(() => {
      edicaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function fecharEdicao() {
    setUsuarioEditando(null);
    setEditNome("");
    setEditEmail("");
    setEditSenha("");
    setEditPerfil(podeGerenciarTodosPerfis ? "gerente_operacional" : "montador");
    setEditTipoLogin(podeGerenciarTodosPerfis ? "email" : "pin");
    setEditCodigoAcesso("");
    setEditPin("");
    setEditAtivo(true);
  }

  async function obterAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? "";
  }

  async function criarUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setSucesso("");
    setSalvando(true);

    const accessToken = await obterAccessToken();

    if (!accessToken) {
      setErro("Sessão expirada. Faça login novamente.");
      setSalvando(false);
      return;
    }

    const response = await fetch("/api/usuarios/criar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        nome,
        email,
        senha,
        perfil,
        tipo_login: tipoLogin,
        codigo_acesso: codigoAcesso,
        pin,
        ativo,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setErro(payload?.error ?? "Não foi possível cadastrar o usuário.");
      setSalvando(false);
      return;
    }

    setSucesso("Usuário cadastrado com sucesso.");

    setNome("");
    setEmail("");
    setSenha("");
    setCodigoAcesso("");
    setPin("");
    setAtivo(true);

    if (tipoLogin === "email") {
      setPerfil(podeGerenciarTodosPerfis ? "gerente_operacional" : "montador");
    } else {
      setPerfil("montador");
      setCodigoAcesso(gerarCodigoMontador(usuarios.length + 1));
    }

    await carregarUsuarios();

    setSalvando(false);
  }

  async function salvarEdicao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!usuarioEditando) return;

    setErro("");
    setSucesso("");
    setSalvando(true);

    const accessToken = await obterAccessToken();

    if (!accessToken) {
      setErro("Sessão expirada. Faça login novamente.");
      setSalvando(false);
      return;
    }

    const response = await fetch("/api/usuarios/atualizar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        usuario_id: usuarioEditando.usuario_id,
        nome: editNome,
        email: editEmail,
        senha: editSenha,
        perfil: editPerfil,
        tipo_login: editTipoLogin,
        codigo_acesso: editCodigoAcesso,
        pin: editPin,
        ativo: editAtivo,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setErro(payload?.error ?? "Não foi possível atualizar o usuário.");
      setSalvando(false);
      return;
    }

    setSucesso("Usuário atualizado com sucesso.");
    fecharEdicao();

    await carregarUsuarios();

    setSalvando(false);
  }

  return (
    <div className="space-y-6">
      <header className="fdl-form-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--fdl-cream)]">
              Administração
            </p>

            <h1 className="mt-2 text-3xl font-bold">Usuários</h1>

            <p className="mt-2 text-sm text-white/60">
              Cadastre, edite, ative ou inative usuários administrativos e
              montadores.
            </p>
          </div>

          {!mostrarForm ? (
            <button
              type="button"
              onClick={() => {
                setErro("");
                setSucesso("");
                setMostrarForm(true);
              }}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-[var(--fdl-cream)] px-5 text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95"
            >
              <span className="text-lg leading-none">＋</span> Novo usuário
            </button>
          ) : null}
        </div>
      </header>

      {erro ? <div className="fdl-ui-alert fdl-ui-alert-error">{erro}</div> : null}
      {sucesso ? (
        <div className="fdl-ui-alert fdl-ui-alert-success">{sucesso}</div>
      ) : null}

      {usuarioEditando ? (
        <section
          ref={edicaoRef}
          className="scroll-mt-24 rounded-3xl border border-[var(--fdl-cream)]/30 bg-white/[0.08] p-6"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--fdl-cream)]">
                Editando usuário
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {usuarioEditando.nome || "Usuário"}
              </h2>
              <p className="fdl-section-subtitle">
                Para alterar o PIN ou senha, preencha o novo valor. Se deixar em
                branco, o acesso atual será mantido.
              </p>
            </div>

            <button
              type="button"
              onClick={fecharEdicao}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              Cancelar edição
            </button>
          </div>

          <form
            onSubmit={salvarEdicao}
            className="mt-6 grid gap-4 lg:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Tipo de acesso
              </label>

              <select
                value={editTipoLogin}
                disabled={!podeGerenciarTodosPerfis}
                onChange={(event) => alterarTipoLoginEdicao(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option className="text-black" value="email">
                  E-mail e senha
                </option>
                <option className="text-black" value="pin">
                  Código + PIN
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Perfil
              </label>

              <select
                value={editPerfil}
                disabled={!podeGerenciarTodosPerfis}
                onChange={(event) => setEditPerfil(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {perfisPermitidos.map((item) => (
                  <option key={item.value} className="text-black" value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Nome
              </label>

              <input
                value={editNome}
                onChange={(event) => setEditNome(event.target.value)}
                required
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                placeholder="Nome completo"
              />
            </div>

            {editTipoLogin === "email" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={editEmail}
                    onChange={(event) => setEditEmail(event.target.value)}
                    required
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="usuario@fabricadeluz.com.br"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Nova senha provisória
                  </label>

                  <input
                    type="password"
                    value={editSenha}
                    onChange={(event) => setEditSenha(event.target.value)}
                    minLength={6}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="Deixe em branco para manter"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Código de acesso
                  </label>

                  <input
                    value={editCodigoAcesso}
                    onChange={(event) =>
                      setEditCodigoAcesso(event.target.value.toUpperCase())
                    }
                    required
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="Exemplo: M1001"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Novo PIN
                  </label>

                  <input
                    value={editPin}
                    onChange={(event) => setEditPin(event.target.value)}
                    inputMode="numeric"
                    minLength={4}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="Deixe em branco para manter"
                  />
                </div>
              </>
            )}

            <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/80">
              <input
                type="checkbox"
                checked={editAtivo}
                onChange={(event) => setEditAtivo(event.target.checked)}
              />
              Usuário ativo
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={salvando}
                className="h-12 flex-1 rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar alterações"}
              </button>

              <button
                type="button"
                onClick={fecharEdicao}
                className="h-12 rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section
        className={`grid items-start gap-6 ${
          mostrarForm ? "xl:grid-cols-[340px_minmax(0,1fr)]" : "grid-cols-1"
        }`}
      >
        {mostrarForm ? (
        <form
          onSubmit={criarUsuario}
          className="fdl-form-card p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="fdl-section-title">Novo usuário</h2>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Tipo de acesso
              </label>

              <select
                value={tipoLogin}
                disabled={!podeGerenciarTodosPerfis}
                onChange={(event) => alterarTipoLogin(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option className="text-black" value="email">
                  E-mail e senha
                </option>
                <option className="text-black" value="pin">
                  Código + PIN
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Nome
              </label>

              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                placeholder="Nome completo"
              />
            </div>

            {tipoLogin === "email" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="usuario@fabricadeluz.com.br"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Senha provisória
                  </label>

                  <input
                    type="password"
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    required
                    minLength={6}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Código de acesso
                  </label>

                  <input
                    value={codigoAcesso}
                    onChange={(event) =>
                      setCodigoAcesso(event.target.value.toUpperCase())
                    }
                    required
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="Exemplo: M1001"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    PIN
                  </label>

                  <input
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    required
                    inputMode="numeric"
                    minLength={4}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--fdl-cream)]"
                    placeholder="Exemplo: 4821"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Perfil
              </label>

              <select
                value={perfil}
                disabled={!podeGerenciarTodosPerfis}
                onChange={(event) => setPerfil(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none focus:border-[var(--fdl-cream)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {perfisPermitidos.map((item) => (
                  <option key={item.value} className="text-black" value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/80">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(event) => setAtivo(event.target.checked)}
              />
              Usuário ativo
            </label>

            <button
              type="submit"
              disabled={salvando}
              className="h-12 w-full rounded-2xl bg-[var(--fdl-cream)] text-sm font-semibold text-[var(--fdl-purple-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Cadastrar usuário"}
            </button>
          </div>
        </form>
        ) : null}

        <section className="fdl-form-card fdl-users-list-card min-w-0 p-6">
          <div className="mb-5">
            <h2 className="fdl-section-title">Usuários cadastrados</h2>
            <p className="fdl-section-subtitle">
              Lista de acessos administrativos e montadores.
            </p>
          </div>

          {carregando ? (
            <div className="fdl-empty-state">
              Carregando usuários...
            </div>
          ) : usuarios.length > 0 ? (
            <div className="fdl-ui-table-wrap">
              <div className="fdl-ui-table-scroll">
                <table className="w-full fdl-ui-table fdl-users-table">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[17%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[20%]" />
                    <col className="w-[96px]" />
                  </colgroup>
                  <thead className="bg-white/10 text-white/70">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Perfil</th>
                      <th className="px-4 py-3">Acesso</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Último PIN</th>
                      <th className="fdl-users-action-cell px-2 py-3 text-center">Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr
                        key={usuario.usuario_id}
                        className="border-t border-white/10"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">
                            {usuario.nome}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {usuario.email || usuario.codigo_acesso || "-"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-white/75">
                          {formatPerfil(usuario.perfil)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[var(--fdl-lilac)] px-3 py-1 text-xs font-semibold text-[var(--fdl-purple-dark)]">
                            {usuario.tipo_login === "pin" ? "PIN" : "E-mail"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              usuario.ativo
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {usuario.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-white/60">
                          {formatDateTime(usuario.ultimo_acesso_pin)}
                        </td>

                        <td className="fdl-users-action-cell px-2 py-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => abrirEdicao(usuario)}
                            className="fdl-users-edit-btn"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="fdl-empty-state">
              Nenhum usuário encontrado ou você não tem permissão para visualizar.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
