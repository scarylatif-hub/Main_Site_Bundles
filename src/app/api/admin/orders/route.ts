// src/app/api/admin/orders/override/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import { isOrderStatusAllowed } from "@/lib/order-status";

export async function POST(req: Request) {
  // 1. Verify the caller is an admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate body
  const body = await req.json().catch(() => ({})) as {
    transaction_id?: string;
    status?: string;
  };

  const { transaction_id, status } = body;

  if (!transaction_id || typeof transaction_id !== "string" || !transaction_id.trim()) {
    return NextResponse.json({ error: "transaction_id is required" }, { status: 400 });
  }

  if (!status || !isOrderStatusAllowed(status)) {
    return NextResponse.json(
      { error: `status must be one of: placed, processing, delivered, canceled` },
      { status: 400 }
    );
  }

  // 3. Upsert into provider_order_overrides
  const admin = createAdminClient();
  const { error } = await admin
    .from("provider_order_overrides")
    .upsert(
      { transaction_id: transaction_id.trim(), status: status.trim() },
      { onConflict: "transaction_id" }
    );

  if (error) {
    console.error("override upsert error:", error.message);
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}