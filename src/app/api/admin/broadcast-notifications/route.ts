import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.admin
    .from("broadcast_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: error.message, items: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  let body: { title?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const message = body.message?.trim();

  if (!title || !message) {
    return NextResponse.json(
      { error: "title and message required" },
      { status: 400 }
    );
  }

  const { data, error } = await ctx.admin
    .from("broadcast_notifications")
    .insert({
      title,
      message,
      created_by: ctx.actorId,
    })
    .select()
    .single();

  if (error) {
    console.error("broadcast_notifications insert:", error);
    return NextResponse.json(
      {
        error:
          error.message ||
          "Could not save. Run SQL migration 002_admin_tables.sql in Supabase.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, item: data });
}
