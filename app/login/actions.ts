"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=preencha");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("ERRO LOGIN SUPABASE:", {
      message: error.message,
      status: error.status,
      name: error.name,
    });

    const message = encodeURIComponent(error.message);
    redirect(`/login?error=auth&message=${message}`);
  }

  if (!data.user) {
    console.error("ERRO LOGIN: Supabase não retornou usuário.");
    redirect("/login?error=sem_usuario");
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", data.user.id)
    .single();

  if (usuarioError || !usuario || !usuario.ativo) {
    console.error("ERRO PERFIL USUARIO:", {
      usuarioError,
      userId: data.user.id,
      email: data.user.email,
    });

    await supabase.auth.signOut();
    redirect("/login?error=perfil");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}