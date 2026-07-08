import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  montadoresNaEquipe,
  resolverUsuario,
  type UsuarioVinculo,
} from "@/lib/importacao/vinculos";

type OsPayload = {
  responsavelComercial?: string | null;
  equipe?: string | null;
};

type UsuarioGestao = {
  usuario_id: string;
  nome: string | null;
  perfil: string | null;
  ativo: boolean | null;
};

// Escolhe, entre todos os textos de "responsável comercial" do cronograma
// (nível projeto + por OS), o gestor cadastrado mais citado. Retorna null
// quando nenhum texto corresponde com confiança a um gestor.
function escolherGestor(
  textos: Array<string | null | undefined>,
  gestores: UsuarioVinculo[]
): UsuarioVinculo | null {
  const contagem = new Map<string, { usuario: UsuarioVinculo; n: number }>();

  for (const texto of textos) {
    const resolvido = resolverUsuario(texto, gestores);

    if (resolvido) {
      const atual = contagem.get(resolvido.usuario_id);

      if (atual) {
        atual.n += 1;
      } else {
        contagem.set(resolvido.usuario_id, { usuario: resolvido, n: 1 });
      }
    }
  }

  let gestor: UsuarioVinculo | null = null;
  let melhorContagem = 0;

  for (const { usuario, n } of contagem.values()) {
    if (n > melhorContagem) {
      melhorContagem = n;
      gestor = usuario;
    }
  }

  return gestor;
}

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

  // Carrega gestores e montadores cadastrados para tentar reconhecer, pelo nome
  // que veio no cronograma, quem é o responsável e a equipe. Best-effort: se a
  // listagem falhar, a importação segue normalmente, apenas sem vínculo
  // automático.
  let gestores: UsuarioVinculo[] = [];
  let montadores: UsuarioVinculo[] = [];

  try {
    const { data: listaUsuarios } = await supabase.rpc(
      "fdl_listar_usuarios_gestao"
    );

    const usuarios = (listaUsuarios ?? []) as UsuarioGestao[];

    gestores = usuarios
      .filter((u) => u.ativo !== false && u.perfil === "gestor_comercial")
      .map((u) => ({ usuario_id: u.usuario_id, nome: u.nome, perfil: u.perfil }));

    montadores = usuarios
      .filter((u) => u.ativo !== false && u.perfil === "montador")
      .map((u) => ({ usuario_id: u.usuario_id, nome: u.nome, perfil: u.perfil }));
  } catch {
    // segue sem vínculo automático
  }

  const ordensServico = Array.isArray(payloadComTemporada.ordensServico)
    ? (payloadComTemporada.ordensServico as OsPayload[])
    : [];

  // Reconhece o gestor comercial pelo texto do cronograma (que pode vir
  // abreviado, ex.: "Koga" -> "Bruno Koga") e grava o nome canônico em
  // responsavelComercial, para o relatório/filtros agruparem corretamente.
  const gestorResolvido = escolherGestor(
    [
      payloadComTemporada.responsavelComercial,
      ...ordensServico.map((os) => os?.responsavelComercial),
    ],
    gestores
  );

  if (gestorResolvido?.nome) {
    payloadComTemporada.responsavelComercial = gestorResolvido.nome;

    for (const os of ordensServico) {
      if (
        os &&
        resolverUsuario(os.responsavelComercial, gestores)?.usuario_id ===
          gestorResolvido.usuario_id
      ) {
        os.responsavelComercial = gestorResolvido.nome;
      }
    }
  }

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

  // Vínculo automático da equipe do projeto (best-effort). Falhas aqui NÃO
  // invalidam a importação — o projeto já foi criado. Apenas registramos o que
  // foi vinculado para exibir/depurar.
  const vinculos: { gestor: string | null; montadores: string[] } = {
    gestor: null,
    montadores: [],
  };

  if (resultado?.projeto_id) {
    if (gestorResolvido) {
      const { error: erroGestor } = await supabase.rpc(
        "fdl_adicionar_usuario_projeto",
        {
          p_projeto_id: resultado.projeto_id,
          p_usuario_id: gestorResolvido.usuario_id,
          p_funcao: "gestor_comercial",
        }
      );

      if (!erroGestor) {
        vinculos.gestor = gestorResolvido.nome;
      }
    }

    // Reúne os montadores citados nas equipes das OSs (e no nível do projeto),
    // sem duplicatas, e vincula cada um ao projeto.
    const montadoresPorId = new Map<string, UsuarioVinculo>();

    for (const os of ordensServico) {
      for (const montador of montadoresNaEquipe(os?.equipe, montadores)) {
        montadoresPorId.set(montador.usuario_id, montador);
      }
    }

    for (const montador of montadoresNaEquipe(
      payloadComTemporada.equipe,
      montadores
    )) {
      montadoresPorId.set(montador.usuario_id, montador);
    }

    for (const montador of montadoresPorId.values()) {
      const { error: erroMontador } = await supabase.rpc(
        "fdl_adicionar_usuario_projeto",
        {
          p_projeto_id: resultado.projeto_id,
          p_usuario_id: montador.usuario_id,
          p_funcao: "montador",
        }
      );

      if (!erroMontador && montador.nome) {
        vinculos.montadores.push(montador.nome);
      }
    }
  }

  return NextResponse.json({
    success: true,
    resultado,
    vinculos,
  });
}