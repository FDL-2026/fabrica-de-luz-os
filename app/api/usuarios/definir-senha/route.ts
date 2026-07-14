import { createClient } from "@supabase/supabase-js";

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

    // A senha em si é trocada pelo cliente (mantém a sessão). Aqui apenas
    // limpamos a flag de senha provisória, que exige privilégio elevado.
    const adminClient = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error: flagError } = await adminClient
      .from("usuarios")
      .update({ senha_provisoria: false })
      .eq("auth_user_id", user.id);

    if (flagError) {
      return Response.json({ error: flagError.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao definir a nova senha.";

    return Response.json({ error: message }, { status: 500 });
  }
}
