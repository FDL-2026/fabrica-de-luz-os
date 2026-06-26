import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);

  return NextResponse.json({
    hasUser: Boolean(user),
    userEmail: user?.email ?? null,
    userId: user?.id ?? null,
    errorMessage: error?.message ?? null,
    cookies: cookieNames,
  });
}