import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function getSafeNext(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");

  if (!next) {
    return "/dashboard";
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

function redirectWithCookies(
  request: NextRequest,
  path: string,
  cookieResponse: NextResponse
) {
  const url = new URL(path, request.url);
  const response = NextResponse.redirect(url);

  cookieResponse.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    response.cookies.set(name, value, options);
  });

  return response;
}

export async function POST(request: NextRequest) {
  let cookieResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookieResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            cookieResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const formData = await request.formData();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = getSafeNext(request);

  if (!email || !password) {
    return NextResponse.redirect(
      new URL(`/login?error=preencha&next=${encodeURIComponent(nextPath)}`, request.url)
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message = encodeURIComponent(error.message);

    return NextResponse.redirect(
      new URL(
        `/login?error=auth&message=${message}&next=${encodeURIComponent(nextPath)}`,
        request.url
      )
    );
  }

  if (!data.user) {
    return NextResponse.redirect(
      new URL(`/login?error=sem_usuario&next=${encodeURIComponent(nextPath)}`, request.url)
    );
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, ativo")
    .eq("auth_user_id", data.user.id)
    .single();

  if (usuarioError || !usuario || !usuario.ativo) {
    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(`/login?error=perfil&next=${encodeURIComponent(nextPath)}`, request.url)
    );
  }

  return redirectWithCookies(request, nextPath, cookieResponse);
}