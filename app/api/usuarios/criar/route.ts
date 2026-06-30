import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERFIS_GERENCIAM_USUARIOS = [
  "admin",
  "diretor",
  "gerente_operacional",
  "gestor_comercial",
];

const PERFIS_GERENCIAM_TODOS = ["admin", "diretor"];

const PERFIS_VALIDOS = [
  "admin",
  "diretor",
  "gestor_comercial",
  "gerente_operacional",
  "montador",
];

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
      !PERFIS_GERENCIAM_USUARIOS.includes(solicitante.perfil)
    ) {
      return Response.json(
        { error: "Você não tem permissão para cadastrar usuários." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const nome = normalizarTexto(body.nome);
    const tipoLogin = normalizarTexto(body.tipo_login || "email");
    const perfil = normalizarTexto(body.perfil);
    const email = normalizarTexto(body.email).toLowerCase();
    const senha = normalizarTexto(body.senha);
    const codigoAcesso = normalizarTexto(body.codigo_acesso).toUpperCase();
    const pin = normalizarTexto(body.pin);
    const ativo = Boolean(body.ativo ?? true);

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

    if (!PERFIS_VALIDOS.includes(perfil)) {
      return Response.json(
        { error: "Perfil inválido." },
        { status: 400 }
      );
    }

    const podeGerenciarTodos = PERFIS_GERENCIAM_TODOS.includes(
      solicitante.perfil
    );

    if (!podeGerenciarTodos && perfil !== "montador") {
      return Response.json(
        { error: "Seu perfil permite cadastrar/editar apenas montadores." },
        { status: 403 }
      );
    }

    if (!podeGerenciarTodos && tipoLogin !== "pin") {
      return Response.json(
        { error: "Montadores devem acessar por Código + PIN." },
        { status: 403 }
      );
    }

    if (perfil === "montador" && tipoLogin !== "pin") {
      return Response.json(
        { error: "Perfil Montador deve usar acesso por Código + PIN." },
        { status: 400 }
      );
    }

    let authUserId: string | null = null;

    if (tipoLogin === "email") {
      if (!email) {
        return Response.json(
          { error: "E-mail é obrigatório." },
          { status: 400 }
        );
      }

      if (!senha || senha.length < 6) {
        return Response.json(
          { error: "Informe uma senha provisória com pelo menos 6 caracteres." },
          { status: 400 }
        );
      }

      const { data: authData, error: authError } =
        await adminClient.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: {
            nome,
            perfil,
          },
        });

      if (authError || !authData.user) {
        return Response.json(
          {
            error:
              authError?.message ||
              "Não foi possível criar o usuário de autenticação.",
          },
          { status: 400 }
        );
      }

      authUserId = authData.user.id;
    }

    if (tipoLogin === "pin") {
      if (!codigoAcesso) {
        return Response.json(
          { error: "Código de acesso é obrigatório para montador." },
          { status: 400 }
        );
      }

      if (!pin || pin.length < 4) {
        return Response.json(
          { error: "PIN deve ter pelo menos 4 dígitos." },
          { status: 400 }
        );
      }
    }

    const { data: usuarioData, error: usuarioError } = await adminClient.rpc(
      "fdl_salvar_usuario_gestao",
      {
        p_nome: nome,
        p_email: email || null,
        p_perfil: perfil,
        p_tipo_login: tipoLogin,
        p_codigo_acesso: codigoAcesso || null,
        p_pin: pin || null,
        p_auth_user_id: authUserId,
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
      error instanceof Error ? error.message : "Erro inesperado ao criar usuário.";

    return Response.json({ error: message }, { status: 500 });
  }
}
