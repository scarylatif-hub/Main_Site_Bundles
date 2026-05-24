import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";
import { normalizeStatusForEarnings } from "@/lib/reseller-earnings";

export const dynamic = "force-dynamic";

// ── Security Check ─────────────────────────────────────────────────────────────

function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If CRON_SECRET is not set, skip the check and allow the request
    console.warn("[cron/sync-orders] CRON_SECRET not configured, skipping security check");
    return true;
  }

  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  return authHeader === expected;
}

// ── Main Handler ───────────────────────────────────────────────────────────────

async function handleSyncOrders(req: NextRequest): Promise<NextResponse> {
  // Security check
  if (!verifyCronSecret(req)) {
    console.error("[cron/sync-orders] Unauthorized - invalid CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  let transactionsChecked = 0;
  let transactionsUpdated = 0;
  let ordersChecked = 0;
  let ordersUpdated = 0;

  console.log("[cron/sync-orders] Starting sync job");

  try {
    // ── Find stuck transactions ────────────────────────────────────────────────
    const { data: stuckTransactions, error: txError } = await admin
      .from("transactions")
      .select("id, dakazina_order_id, status")
      .eq("transaction_type", "purchase")
      .eq("status", "pending")
      .not("dakazina_order_id", "is", null)
      .like("dakazina_order_id", "926%")
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .lte("created_at", threeMinutesAgo.toISOString());

    if (txError) {
      console.error("[cron/sync-orders] Failed to fetch stuck transactions:", txError);
    } else {
      transactionsChecked = stuckTransactions?.length ?? 0;
      console.log(`[cron/sync-orders] Found ${transactionsChecked} stuck transactions`);

      // ── Check each transaction with Dakazina ───────────────────────────────────
      for (const tx of stuckTransactions ?? []) {
        const { id, dakazina_order_id } = tx;
        try {
          console.log(`[cron/sync-orders] Checking transaction ${id} with dakazina_order_id: ${dakazina_order_id}`);

          const result = await datakazinaAPI.fetchSingleTransaction(dakazina_order_id, false);

          if (result.ok && result.data) {
            const data = result.data as Record<string, unknown>;
            const dakazinaStatus = data.status as string | undefined;

            if (dakazinaStatus) {
              console.log(`[cron/sync-orders] Dakazina status for ${dakazina_order_id}: ${dakazinaStatus}`);

              const normalizedStatus = normalizeStatusForEarnings(dakazinaStatus);
              console.log(`[cron/sync-orders] Normalized status: ${normalizedStatus}`);

              if (normalizedStatus !== "pending") {
                const { error: updateError } = await admin
                  .from("transactions")
                  .update({ status: normalizedStatus })
                  .eq("id", id);

                if (!updateError) {
                  transactionsUpdated++;
                  console.log(`[cron/sync-orders] Updated transaction ${id} to ${normalizedStatus}`);
                } else {
                  console.error(`[cron/sync-orders] Failed to update transaction ${id}:`, updateError);
                }
              } else {
                console.log(`[cron/sync-orders] Transaction ${id} still pending, no update needed`);
              }
            } else {
              console.log(`[cron/sync-orders] No status field in Dakazina response for ${dakazina_order_id}`);
            }
          } else {
            console.log(`[cron/sync-orders] Dakazina API returned error for ${dakazina_order_id}: ${result.rawText}`);
          }
        } catch (err) {
          console.error(`[cron/sync-orders] Error checking transaction ${id}:`, err);
          // Continue to next transaction
        }
      }
    }

    // ── Find stuck store orders ─────────────────────────────────────────────────
    const { data: stuckOrders, error: orderError } = await admin
      .from("orders")
      .select("id, dakazina_order_id, status")
      .eq("status", "processing")
      .not("dakazina_order_id", "is", null)
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .lte("created_at", threeMinutesAgo.toISOString());

    if (orderError) {
      console.error("[cron/sync-orders] Failed to fetch stuck orders:", orderError);
    } else {
      ordersChecked = stuckOrders?.length ?? 0;
      console.log(`[cron/sync-orders] Found ${ordersChecked} stuck store orders`);

      // ── Check each order with Dakazina ─────────────────────────────────────────
      for (const order of stuckOrders ?? []) {
        const { id, dakazina_order_id } = order;
        try {
          console.log(`[cron/sync-orders] Checking order ${id} with dakazina_order_id: ${dakazina_order_id}`);

          const result = await datakazinaAPI.fetchSingleTransaction(dakazina_order_id, false);

          if (result.ok && result.data) {
            const data = result.data as Record<string, unknown>;
            const dakazinaStatus = data.status as string | undefined;

            if (dakazinaStatus) {
              console.log(`[cron/sync-orders] Dakazina status for order ${dakazina_order_id}: ${dakazinaStatus}`);

              const normalizedStatus = normalizeStatusForEarnings(dakazinaStatus);
              console.log(`[cron/sync-orders] Normalized status: ${normalizedStatus}`);

              if (normalizedStatus === "delivered") {
                const { error: updateError } = await admin
                  .from("orders")
                  .update({ status: "delivered" })
                  .eq("id", id);

                if (!updateError) {
                  ordersUpdated++;
                  console.log(`[cron/sync-orders] Updated order ${id} to delivered`);
                } else {
                  console.error(`[cron/sync-orders] Failed to update order ${id}:`, updateError);
                }
              } else {
                console.log(`[cron/sync-orders] Order ${id} status is ${normalizedStatus}, no update needed`);
              }
            } else {
              console.log(`[cron/sync-orders] No status field in Dakazina response for order ${dakazina_order_id}`);
            }
          } else {
            console.log(`[cron/sync-orders] Dakazina API returned error for order ${dakazina_order_id}: ${result.rawText}`);
          }
        } catch (err) {
          console.error(`[cron/sync-orders] Error checking order ${id}:`, err);
          // Continue to next order
        }
      }
    }

    // ── Final summary ───────────────────────────────────────────────────────────
    console.log(`[cron/sync-orders] Sync complete: ${transactionsChecked} transactions checked, ${transactionsUpdated} updated, ${ordersChecked} orders checked, ${ordersUpdated} updated`);

    return NextResponse.json({
      ok: true,
      transactions_checked: transactionsChecked,
      transactions_updated: transactionsUpdated,
      orders_checked: ordersChecked,
      orders_updated: ordersUpdated,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[cron/sync-orders] Unhandled error:", err);
    // Always return 200 even on error
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      transactions_checked: transactionsChecked,
      transactions_updated: transactionsUpdated,
      orders_checked: ordersChecked,
      orders_updated: ordersUpdated,
      timestamp: now.toISOString(),
    });
  }
}

// ── Export handlers ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return handleSyncOrders(req);
}

export async function GET(req: NextRequest) {
  return handleSyncOrders(req);
}
