import { createClient } from "@supabase/supabase-js";
import {
  PERFIL_GESTOR,
  ehVinculado,
  perfisQuePodeGerenciar,
  podeGerenciarUsuarios,
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
      { auth: { persistSession: false, autoRefreshToken: false } }
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
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: solicitante } = await adminClient
      .from("usuarios")
      .select("id, nome, perfil, ativo")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (
      !solicitante ||
      !solicitante.ativo ||
      !podeGerenciarUsuarios(solicitante.perfil)
    ) {
      return Response.json(
        { error: "Você não tem permissão para excluir usuários." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const usuarioId = String(body?.usuario_id ?? "").trim();

    if (!usuarioId) {
      return Response.json({ error: "Usuário não informado." }, { status: 400 });
    }

    if (usuarioId === solicitante.id) {
      return Response.json(
        { error: "Você não pode excluir o seu próprio usuário." },
        { status: 400 }
      );
    }

    const { data: alvo } = await adminClient
      .from("usuarios")
      .select("id, auth_user_id, nome, email, perfil, gestor_id")
      .eq("id", usuarioId)
      .maybeSingle();

    if (!alvo) {
      return Response.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    // Mesma hierarquia da edição.
    const permitidos = perfisQuePodeGerenciar(solicitante.perfil);
    if (!permitidos.includes(alvo.perfil)) {
      return Response.json(
        { error: "Você não tem permissão para excluir este usuário." },
        { status: 403 }
      );
    }

    if (
      solicitante.perfil === PERFIL_GESTOR &&
      ehVinculado(alvo.perfil) &&
      alvo.gestor_id !== solicitante.id
    ) {
      return Response.json(
        { error: "Este usuário está vinculado a outro gestor." },
        { status: 403 }
      );
    }

    // Exclui o registro em usuarios primeiro: se houver histórico vinculado
    // (registros, validações, equipe, chamados), a FK bloqueia e nada é
    // apagado — orientamos a inativar.
    const { error: deleteError } = await adminClient
      .from("usuarios")
      .delete()
      .eq("id", usuarioId);

    if (deleteError) {
      return Response.json(
        {
          error:
            "Não foi possível excluir: o usuário possui histórico vinculado (registros, validações, equipe ou chamados). Para preservar o histórico, inative-o em vez de excluir.",
        },
        { status: 409 }
      );
    }

    // Remove o acesso de autenticação (usuários por e-mail).
    if (alvo.auth_user_id) {
      await adminClient.auth.admin.deleteUser(alvo.auth_user_id).catch(() => null);
    }

    // Auditoria (após a exclusão, com o snapshot capturado).
    await adminClient.from("usuarios_auditoria").insert({
      usuario_id: alvo.id,
      usuario_nome: alvo.nome,
      usuario_email: alvo.email,
      acao: "excluido",
      detalhes: `Perfil: ${alvo.perfil}`,
      autor_id: solicitante.id,
      autor_nome: solicitante.nome,
      autor_perfil: solicitante.perfil,
    });

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao excluir usuário.";

    return Response.json({ error: message }, { status: 500 });
  }
}
