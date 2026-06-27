import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(nextPath = "/dashboard") {
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
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", user.id)
    .single();

  if (usuarioError || !usuario || !usuario.ativo) {
    redirect("/login?error=perfil");
  }

  return {
    supabase,
    user,
    usuario,
  };
}