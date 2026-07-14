import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(
  nextPath = "/dashboard",
  opts: { negarPerfis?: string[]; ignorarSenhaProvisoria?: boolean } = {}
) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo, senha_provisoria")
    .eq("auth_user_id", user.id)
    .single();

  if (usuarioError || !usuario || !usuario.ativo) {
    redirect("/login?error=perfil");
  }

  // Senha provisória: força a troca antes de liberar qualquer tela.
  if (!opts.ignorarSenhaProvisoria && usuario.senha_provisoria) {
    redirect("/definir-senha");
  }

  // Bloqueio por perfil (ex.: visitante não acessa telas de escrita/admin).
  if (opts.negarPerfis && opts.negarPerfis.includes(usuario.perfil)) {
    redirect("/dashboard");
  }

  return {
    supabase,
    user,
    usuario,
  };
}