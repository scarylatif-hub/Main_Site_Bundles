/**
 * src/app/api/admin/orders/retry/route.ts
 *
 * Manual retry of a failed / retry_pending guest order.
 * Restricted to authenticated admin users only.
 *
 * Flow:
 *  1. Require admin session (service-role check against profiles.is_admin)
 *  2. Validate order exists and is in a retryable state
 *  3. Resolve package from DataKazina
 *  4. Set order to "processing", call DataKazina with retry logic
 *  5. On success → mark "completed"
 *  6. On failure → mark "failed" with error detaillll
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }               from "@/lib/supabase/server";
import { createAdminClient }          from "@/lib/supabase/admin";
import { datakazinaAPI }              from "@/lib/datakazina";
import { retryWithBackoff }           from "@/lib/server/retry";
import { mapToDataKazinaNetworkId }   from "@/lib/networks";

const RETRYABLE_STATUSES = new Set(["failed", "retry_pending"]);

export async function POST(req: NextRequest) {
  // 1. Auth — must be a logged-in admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse body + validate
  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { order_id } = body;
  if (!order_id) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, status, phone_number, network_id, package_id, payment_reference, amount")
    .eq("id", order_id)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!RETRYABLE_STATUSES.has(order.status)) {
    return NextResponse.json(
      { error: `Order cannot be retried. Current status: ${order.status}` },
      { status: 400 }
    );
  }

  // 3. Resolve package from DataKazina
  const pkgResult = await datakazinaAPI.fetchDataPackages();
  if (!pkgResult.ok) {
    return NextResponse.json({ error: "Could not fetch packages from DataKazina" }, { status: 502 });
  }

  const pkg = pkgResult.data.find((p) => String(p.id) === String(order.package_id));
  if (!pkg) {
    return NextResponse.json(
      { error: `Package ${order.package_id} not found in DataKazina` },
      { status: 404 }
    );
  }

  // 4. Set order to "processing" before attempting delivery
  await admin
    .from("orders")
    .update({ status: "processing", error_message: null })
    .eq("id", order_id);

  const retryRef = `retry-${order_id}-${Date.now()}`;

  // Map frontend network ID to DataKazina network ID
  const datakazinaNetworkId = mapToDataKazinaNetworkId(Number(order.network_id));
  // Removed network mapping logging to prevent exposing internal logic

  const deliveryResult = await retryWithBackoff(
    async () => {
      const res = await datakazinaAPI.purchaseDataPackage({
        recipient_msisdn: order.phone_number,
        network_id:       datakazinaNetworkId,
        shared_bundle:    Number(pkg.id),
        incoming_api_ref: retryRef,
      });

      if (!res.ok) {
        throw new Error(res.rawText || `DataKazina error ${res.status}`);
      }
      if (!res.data.transaction_code && !res.data.reference) {
        throw new Error(String(res.data.message ?? "No transaction code in response"));
      }
      return res.data;
    },
    3,
    2_000
  );

  // 5. Update order with outcome
  if (!deliveryResult.success) {
    console.error("[admin/retry] All attempts exhausted for order", order_id, deliveryResult.error);

    await admin
      .from("orders")
      .update({
        status:        "failed",
        error_message: deliveryResult.error,
      })
      .eq("id", order_id);

    return NextResponse.json(
      {
        error:   "Retry failed after all attempts",
        details: deliveryResult.error,
      },
      { status: 502 }
    );
  }

  const providerCode =
    deliveryResult.data.transaction_code ??
    deliveryResult.data.reference ??
    retryRef;

  await admin
    .from("orders")
    .update({
      status:                  "completed",
      paystack_transaction_id: providerCode,
      error_message:           null,
    })
    .eq("id", order_id);

  return NextResponse.json({
    success:          true,
    message:          "Order retried successfully",
    transaction_code: providerCode,
  });
}