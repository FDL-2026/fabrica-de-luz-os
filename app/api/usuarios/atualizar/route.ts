import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERFIS_ADMIN = ["admin", "gerente_geral"];

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
      .select("id, perfil, ativo")
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
      !PERFIS_ADMIN.includes(solicitante.perfil)
    ) {
      return Response.json(
        { error: "Você não tem permissão para editar usuários." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const usuarioId = normalizarTexto(body.usuario_id);
    const nome = normalizarTexto(body.nome);
    const tipoLogin = normalizarTexto(body.tipo_login || "email");
    const perfil = normalizarTexto(body.perfil);
    const email = normalizarTexto(body.email).toLowerCase();
    const senha = normalizarTexto(body.senha);
    const codigoAcesso = normalizarTexto(body.codigo_acesso).toUpperCase();
    const pin = normalizarTexto(body.pin);
    const ativo = Boolean(body.ativo ?? true);

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

    if (!["email", "pin"].includes(tipoLogin)) {
      return Response.json(
        { error: "Tipo de acesso inválido." },
        { status: 400 }
      );
    }

    const { data: usuarioAtual, error: usuarioAtualError } = await adminClient
      .from("usuarios")
      .select("id, auth_user_id, email, tipo_login")
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
