import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Usuário não autenticado." },
      { status: 401 }
    );
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", user.id)
    .single();

  if (usuarioError || !usuario || !usuario.ativo) {
    return NextResponse.json(
      { error: "Usuário sem perfil ativo no sistema." },
      { status: 403 }
    );
  }

  const perfisPermitidos = ["admin", "gerente_geral", "gestor_contas"];

  if (!perfisPermitidos.includes(usuario.perfil)) {
    return NextResponse.json(
      { error: "Seu perfil não tem permissão para importar cronogramas." },
      { status: 403 }
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Payload inválido para importação." },
      { status: 400 }
    );
  }

  if (!payload?.cliente || !Array.isArray(payload?.ordensServico)) {
    return NextResponse.json(
      { error: "Prévia de importação incompleta." },
      { status: 400 }
    );
  }

  const payloadComTemporada = {
    temporada: "2026",
    ...payload,
  };

  const { data, error } = await supabase.rpc(
    "confirmar_importacao_cronograma",
    {
      p_payload: payloadComTemporada,
      p_usuario_id: usuario.id,
    }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  const resultado = Array.isArray(data) ? data[0] : null;

  if (!resultado) {
    return NextResponse.json(
      { error: "A importação não retornou resultado." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    resultado,
  });
}