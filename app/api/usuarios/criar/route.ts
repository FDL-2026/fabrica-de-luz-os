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
      !podeGerenciarUsuarios(solicitante.perfil)
    ) {
      return Response.json(
        { error: "Você não tem permissão para cadastrar usuários." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const nome = normalizarTexto(body.nome);
    const perfil = normalizarTexto(body.perfil);
    const email = normalizarTexto(body.email).toLowerCase();
    const senha = normalizarTexto(body.senha);
    const codigoAcesso = normalizarTexto(body.codigo_acesso).toUpperCase();
    const pin = normalizarTexto(body.pin);
    const ativo = Boolean(body.ativo ?? true);
    const gestorIdInformado = normalizarTexto(body.gestor_id);

    if (!nome) {
      return Response.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    if (!perfil) {
      return Response.json({ error: "Perfil é obrigatório." }, { status: 400 });
    }

    // Perfil precisa estar dentro do que o solicitante pode gerenciar.
    const permitidos = perfisQuePodeGerenciar(solicitante.perfil);
    if (!permitidos.includes(perfil)) {
      return Response.json(
        { error: "Seu perfil não permite cadastrar esse tipo de usuário." },
        { status: 403 }
      );
    }

    // O tipo de login é definido pelo perfil (montador = PIN, demais = e-mail).
    const tipoLogin = tipoLoginDoPerfil(perfil);

    // Resolve o gestor vinculado (analista/assistente/estagiário/auxiliar).
    let gestorId: string | null = null;
    if (ehVinculado(perfil)) {
      if (solicitante.perfil === PERFIL_GESTOR) {
        gestorId = solicitante.id;
      } else {
        // Acesso total precisa indicar a qual gestor o usuário fica vinculado.
        if (!gestorIdInformado) {
          return Response.json(
            { error: "Selecione o gestor ao qual este usuário ficará vinculado." },
            { status: 400 }
          );
        }
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
      }
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

    const novo = Array.isArray(usuarioData) ? usuarioData[0] : usuarioData;

    // Ajustes pós-criação (a função de salvar não conhece gestor_id nem a
    // flag de senha provisória):
    //  - vínculo com o gestor (perfis vinculados)
    //  - senha provisória para acessos por e-mail (troca no 1º login)
    const ajustes: { gestor_id?: string; senha_provisoria?: boolean } = {};
    if (gestorId) ajustes.gestor_id = gestorId;
    if (tipoLogin === "email") ajustes.senha_provisoria = true;

    if (Object.keys(ajustes).length > 0) {
      const novoId = novo?.usuario_id ?? novo?.id ?? null;
      const alvo = adminClient.from("usuarios").update(ajustes);
      const { error: ajusteError } = novoId
        ? await alvo.eq("id", novoId)
        : tipoLogin === "email"
          ? await alvo.eq("email", email)
          : await alvo.eq("codigo_acesso", codigoAcesso);

      if (ajusteError) {
        return Response.json({ error: ajusteError.message }, { status: 400 });
      }
    }

    return Response.json({
      ok: true,
      usuario: novo ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao criar usuário.";

    return Response.json({ error: message }, { status: 500 });
  }
}
