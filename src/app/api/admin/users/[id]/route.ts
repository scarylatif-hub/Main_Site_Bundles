import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { ADMIN_EMAIL } from "@/lib/admin-config";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: row } = await ctx.admin
    .from("profiles")
    .select("email")
    .eq("id", id)
    .maybeSingle();

  if (row?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json(
      { error: "Cannot delete the primary admin account" },
      { status: 400 }
    );
  }

  const { error } = await ctx.admin.auth.admin.deleteUser(id);
  if (error) {
    console.error("deleteUser:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
