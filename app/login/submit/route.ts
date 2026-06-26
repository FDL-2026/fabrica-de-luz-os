import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const formData = await request.formData();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/login?error=preencha", request.url));
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message = encodeURIComponent(error.message);
    return NextResponse.redirect(
      new URL(`/login?error=auth&message=${message}`, request.url)
    );
  }

  if (!data.user) {
    return NextResponse.redirect(
      new URL("/login?error=sem_usuario", request.url)
    );
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", data.user.id)
    .single();

  if (usuarioError || !usuario || !usuario.ativo) {
    await supabase.auth.signOut();

    return NextResponse.redirect(new URL("/login?error=perfil", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}