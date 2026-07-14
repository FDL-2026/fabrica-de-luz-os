import { createClient } from "@supabase/supabase-js";
import {
  PERFIL_GESTOR,
  ehVinculado,
  perfisQuePodeGerenciar,
  podeGerenciarUsuarios,
  tipoLoginDoPerfil,
} from "@/lib/perfis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }

  return value;
}

function normalizarTexto(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.replace("Bearer ", "").trim();

    if (!token) {
      return Response.json(
        { error: "Sessão não encontrada. Faça login novamente." },
        { status: 401 }
      );
    }

    const authClient = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return Response.json(
        { error: "Sessão inválida. Faça login novamente." },
        { status: 401 }
      );
    }

    const adminClient = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: solicitante, error: solicitanteError } = await adminClient
      .from("usuarios")
      .select("id, nome, perfil, ativo")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (solicitanteError) {
      return Response.json(
        { error: solicitanteError.message },
        { status: 400 }
      );
    }

    if (
      !solicitante ||
      !solicitante.ativo ||
      !podeGerenciarUsuarios(solicitante.perfil)
    ) {
      return Response.json(
        { error: "Você não tem permissão para editar usuários." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const usuarioId = normalizarTexto(body.usuario_id);
    const nome = normalizarTexto(body.nome);
    const perfil = normalizarTexto(body.perfil);
    const email = normalizarTexto(body.email).toLowerCase();
    const senha = normalizarTexto(body.senha);
    const codigoAcesso = normalizarTexto(body.codigo_acesso).toUpperCase();
    const pin = normalizarTexto(body.pin);
    const ativo = Boolean(body.ativo ?? true);
    const gestorIdInformado = normalizarTexto(body.gestor_id);

    if (!usuarioId) {
      return Response.json(
        { error: "Usuário não informado." },
        { status: 400 }
      );
    }

    if (!nome) {
      return Response.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    if (!perfil) {
      return Response.json({ error: "Perfil é obrigatório." }, { status: 400 });
    }

    const permitidos = perfisQuePodeGerenciar(solicitante.perfil);
    if (!permitidos.includes(perfil)) {
      return Response.json(
        { error: "Seu perfil não permite atribuir esse tipo de acesso." },
        { status: 403 }
      );
    }

    // O tipo de login é definido pelo perfil (montador = PIN, demais = e-mail).
    const tipoLogin = tipoLoginDoPerfil(perfil);

    const { data: usuarioAtual, error: usuarioAtualError } = await adminClient
      .from("usuarios")
      .select("id, auth_user_id, email, tipo_login, perfil, gestor_id, ativo")
      .eq("id", usuarioId)
      .maybeSingle();

    if (usuarioAtualError) {
      return Response.json(
        { error: usuarioAtualError.message },
        { status: 400 }
      );
    }

    if (!usuarioAtual) {
      return Response.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    // O perfil atual do editado também precisa estar no escopo do solicitante.
    if (!permitidos.includes(usuarioAtual.perfil)) {
      return Response.json(
        { error: "Você não tem permissão para editar este usuário." },
        { status: 403 }
      );
    }

    // Gestor não pode editar vinculados de outro gestor.
    if (
      solicitante.perfil === PERFIL_GESTOR &&
      ehVinculado(usuarioAtual.perfil) &&
      usuarioAtual.gestor_id !== solicitante.id
    ) {
      return Response.json(
        { error: "Este usuário está vinculado a outro gestor." },
        { status: 403 }
      );
    }

    // Resolve o gestor vinculado ao salvar.
    let gestorId: string | null = null;
    if (ehVinculado(perfil)) {
      if (solicitante.perfil === PERFIL_GESTOR) {
        gestorId = solicitante.id;
      } else if (gestorIdInformado) {
        const { data: gestor } = await adminClient
          .from("usuarios")
          .select("id, perfil")
          .eq("id", gestorIdInformado)
          .maybeSingle();
        if (!gestor || gestor.perfil !== PERFIL_GESTOR) {
          return Response.json(
            { error: "Gestor vinculado inválido." },
            { status: 400 }
          );
        }
        gestorId = gestor.id;
      } else {
        // Mantém o vínculo atual se nada novo foi informado.
        gestorId = usuarioAtual.gestor_id ?? null;
        if (!gestorId) {
          return Response.json(
            { error: "Selecione o gestor ao qual este usuário ficará vinculado." },
            { status: 400 }
          );
        }
      }
    }

    let authUserId: string | null = usuarioAtual.auth_user_id ?? null;

    if (tipoLogin === "email") {
      if (!email) {
        return Response.json(
          { error: "E-mail é obrigatório." },
          { status: 400 }
        );
      }

      if (!authUserId && !senha) {
        return Response.json(
          {
            error:
              "Este usuário ainda não possui acesso por e-mail. Informe uma senha provisória.",
          },
          { status: 400 }
        );
      }

      if (senha && senha.length < 6) {
        return Response.json(
          { error: "A senha provisória precisa ter pelo menos 6 caracteres." },
          { status: 400 }
        );
      }

      if (authUserId) {
        const authUpdate: {
          email?: string;
          password?: string;
          user_metadata?: {
            nome: string;
            perfil: string;
          };
        } = {
          user_metadata: {
            nome,
            perfil,
          },
        };

        if (email && email !== usuarioAtual.email) {
          authUpdate.email = email;
        }

        if (senha) {
          authUpdate.password = senha;
        }

        const { error: updateAuthError } =
          await adminClient.auth.admin.updateUserById(authUserId, authUpdate);

        if (updateAuthError) {
          return Response.json(
            { error: updateAuthError.message },
            { status: 400 }
          );
        }
      } else {
        const { data: authData, error: createAuthError } =
          await adminClient.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: {
              nome,
              perfil,
            },
          });

        if (createAuthError || !authData.user) {
          return Response.json(
            {
              error:
                createAuthError?.message ||
                "Não foi possível criar o acesso por e-mail.",
            },
            { status: 400 }
          );
        }

        authUserId = authData.user.id;

        const { error: authLinkError } = await adminClient
          .from("usuarios")
          .update({ auth_user_id: authUserId })
          .eq("id", usuarioId);

        if (authLinkError) {
          return Response.json(
            { error: authLinkError.message },
            { status: 400 }
          );
        }
      }
    }

    if (tipoLogin === "pin") {
      if (!codigoAcesso) {
        return Response.json(
          { error: "Código de acesso é obrigatório para montador." },
          { status: 400 }
        );
      }

      if (pin && pin.length < 4) {
        return Response.json(
          { error: "O PIN deve ter pelo menos 4 dígitos." },
          { status: 400 }
        );
      }
    }

    const { data: usuarioData, error: usuarioError } = await adminClient.rpc(
      "fdl_atualizar_usuario_gestao",
      {
        p_usuario_id: usuarioId,
        p_nome: nome,
        p_email: email || null,
        p_perfil: perfil,
        p_tipo_login: tipoLogin,
        p_codigo_acesso: codigoAcesso || null,
        p_pin: pin || null,
        p_ativo: ativo,
      }
    );

    if (usuarioError) {
      return Response.json({ error: usuarioError.message }, { status: 400 });
    }

    // Atualiza o vínculo com o gestor (limpa quando o perfil deixa de ser
    // vinculado). Se o gestor definiu uma nova senha, o usuário precisará
    // trocá-la no próximo login.
    const ajustes: { gestor_id: string | null; senha_provisoria?: boolean } = {
      gestor_id: gestorId,
    };
    if (tipoLogin === "email" && senha) {
      ajustes.senha_provisoria = true;
    }

    const { error: vinculoError } = await adminClient
      .from("usuarios")
      .update(ajustes)
      .eq("id", usuarioId);

    if (vinculoError) {
      return Response.json({ error: vinculoError.message }, { status: 400 });
    }

    // Auditoria — resume o que mudou
    const mudancas: string[] = [];
    if (usuarioAtual.perfil !== perfil) {
      mudancas.push(`perfil: ${usuarioAtual.perfil} → ${perfil}`);
    }
    if (email && email !== usuarioAtual.email) {
      mudancas.push("e-mail alterado");
    }
    if (tipoLogin === "email" && senha) {
      mudancas.push("senha redefinida");
    }
    const mudouAtivo = Boolean(usuarioAtual.ativo) !== ativo;
    const acao = mudouAtivo ? (ativo ? "ativado" : "inativado") : "alterado";
    if (mudouAtivo) {
      mudancas.push(ativo ? "reativado" : "inativado");
    }

    await adminClient.from("usuarios_auditoria").insert({
      usuario_id: usuarioId,
      usuario_nome: nome,
      usuario_email: email || null,
      acao,
      detalhes: mudancas.length > 0 ? mudancas.join("; ") : "Sem alterações relevantes",
      autor_id: solicitante.id,
      autor_nome: solicitante.nome,
      autor_perfil: solicitante.perfil,
    });

    return Response.json({
      ok: true,
      usuario: Array.isArray(usuarioData) ? usuarioData[0] : null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao atualizar usuário.";

    return Response.json({ error: message }, { status: 500 });
  }
}
