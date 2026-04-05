import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Sign in on the server and write Supabase auth cookies onto this response.
 * Avoids client-side setSession(), which races with AuthProvider and triggers
 * navigator.locks errors ("another request stole it").
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = NextResponse.json({ success: true });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        { error: authError?.message || "Invalid email or password." },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      await supabaseAdmin.from("profiles").upsert([
        {
          id: userId,
          email: authData.user.email,
          full_name: authData.user.user_metadata?.full_name || "",
          phone_number: authData.user.user_metadata?.phone_number || "",
          wallet_balance: 0,
          is_admin: false,
        },
      ]);
    }

    return res;
  } catch (error: unknown) {
    console.error("Error in POST /api/auth/signin:", error);
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json(
      { error: message, details: String(error) },
      { status: 401 }
    );
  }
}
