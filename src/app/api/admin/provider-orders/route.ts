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

/**
 * POST /api/admin/provider-orders
 * Body: { transaction_ids: string[], status: string }
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  let body: { transaction_ids?: string[]; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status?.trim().toLowerCase();
  const transaction_ids = Array.from(
    new Set(
      (body.transaction_ids || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );

  if (!status || transaction_ids.length === 0) {
    return NextResponse.json(
      { error: "transaction_ids and status required" },
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

  const { data: existingRows, error: existingError } = await ctx.admin
    .from("provider_order_overrides")
    .select("transaction_id,status")
    .in("transaction_id", transaction_ids);

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message || "Failed to read current overrides" },
      { status: 500 }
    );
  }

  const previousById = new Map<string, string | null>();
  for (const row of existingRows || []) {
    previousById.set(row.transaction_id, row.status ?? null);
  }

  const nowIso = new Date().toISOString();
  const payload = transaction_ids.map((transaction_id) => ({
    transaction_id,
    status,
    updated_at: nowIso,
  }));

  const { error } = await ctx.admin
    .from("provider_order_overrides")
    .upsert(payload, { onConflict: "transaction_id" });

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Could not save. Run SQL migration 002_admin_tables.sql in Supabase.",
      },
      { status: 500 }
    );
  }

  if (status === "delivered") {
    for (const transaction_id of transaction_ids) {
      void notifyAdminOrderDeliveredIfNeeded({
        admin: ctx.admin,
        transaction_id,
        previousStatus: previousById.get(transaction_id) ?? null,
        newStatus: status,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status,
    updated_count: transaction_ids.length,
  });
}
