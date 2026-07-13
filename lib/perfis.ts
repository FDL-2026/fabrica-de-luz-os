// Perfis de acesso do sistema (comercial operacional) e regras de hierarquia.
// Fonte única usada pela UI de usuários e pelas rotas de criar/atualizar.

export const PERFIL_ADMIN = "admin";
export const PERFIL_GESTOR = "gestor_comercial";

// Perfis com acesso total (gerenciam qualquer perfil e validam qualquer projeto)
export const PERFIS_TODOS = ["admin", "diretor", "gerente_operacional"] as const;

// Perfis vinculados a um gestor — herdam o acesso do gestor (validações e
// cadastros), restritos aos projetos daquele gestor.
export const PERFIS_VINCULADOS = [
  "analista",
  "assistente",
  "estagiario",
  "auxiliar",
] as const;

// Todos os perfis aceitos pelo banco (mesma lista da CHECK usuarios_perfil_check).
export const PERFIS_VALIDOS = [
  "admin",
  "diretor",
  "gerente_operacional",
  "gestor_comercial",
  "analista",
  "assistente",
  "estagiario",
  "auxiliar",
  "montador",
  "visitante",
] as const;

export const PERFIL_LABEL: Record<string, string> = {
  admin: "Admin",
  diretor: "Diretor",
  gerente_operacional: "Gerente Comercial Operacional",
  gestor_comercial: "Gestor Comercial Operacional",
  analista: "Analista Comercial Operacional",
  assistente: "Assistente Comercial Operacional",
  estagiario: "Estagiário Comercial Operacional",
  auxiliar: "Auxiliar Comercial Operacional",
  montador: "Montador",
  visitante: "Visitante",
};

export function formatarPerfil(perfil: string | null | undefined) {
  if (!perfil) return "-";
  return PERFIL_LABEL[perfil] ?? perfil;
}

export function gerenciaTodos(perfil: string | null | undefined) {
  return (PERFIS_TODOS as readonly string[]).includes(perfil ?? "");
}

export function ehVinculado(perfil: string | null | undefined) {
  return (PERFIS_VINCULADOS as readonly string[]).includes(perfil ?? "");
}

export function ehSomenteLeitura(perfil: string | null | undefined) {
  return perfil === "visitante";
}

// Perfis que um solicitante pode criar/editar.
export function perfisQuePodeGerenciar(perfil: string | null | undefined): string[] {
  if (gerenciaTodos(perfil)) {
    // Todos os perfis, exceto admin (super-usuário gerido manualmente).
    return PERFIS_VALIDOS.filter((p) => p !== "admin");
  }
  if (perfil === PERFIL_GESTOR) {
    return [...PERFIS_VINCULADOS, "montador"];
  }
  if (ehVinculado(perfil)) {
    return ["montador"];
  }
  return [];
}

export function podeGerenciarUsuarios(perfil: string | null | undefined) {
  return perfisQuePodeGerenciar(perfil).length > 0;
}

// Tipo de login exigido por cada perfil: montador entra por Código + PIN,
// os demais por e-mail + senha.
export function tipoLoginDoPerfil(perfil: string): "email" | "pin" {
  return perfil === "montador" ? "pin" : "email";
}
