import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { isOrderStatusAllowed } from "@/lib/order-status";
import { notifyAdminOrderDeliveredIfNeeded } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/provider-orders
 * Body: { transaction_id: string, status: string }
 */
export async function PATCH(request: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  let body: { transaction_id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transaction_id = body.transaction_id?.trim();
  const status = body.status?.trim();

  if (!transaction_id || !status) {
    return NextResponse.json(
      { error: "transaction_id and status required" },
      { status: 400 }
    );
  }

  if (!isOrderStatusAllowed(status)) {
    return NextResponse.json(
      {
        error:
          "Invalid status. Use: placed, processing, delivered, canceled",
      },
      { status: 400 }
    );
  }

  const { data: existing } = await ctx.admin
    .from("provider_order_overrides")
    .select("status")
    .eq("transaction_id", transaction_id)
    .maybeSingle();

  const previousStatus = existing?.status ?? null;

  const { error } = await ctx.admin.from("provider_order_overrides").upsert(
    {
      transaction_id,
      status: status.toLowerCase(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "transaction_id" }
  );

  if (error) {
    console.error("provider_order_overrides upsert:", error);
    return NextResponse.json(
      {
        error:
          error.message ||
          "Could not save. Run SQL migration 002_admin_tables.sql in Supabase.",
      },
      { status: 500 }
    );
  }

  void notifyAdminOrderDeliveredIfNeeded({
    admin: ctx.admin,
    transaction_id,
    previousStatus,
    newStatus: status.toLowerCase(),
  });

  return NextResponse.json({ ok: true, transaction_id, status });
}
