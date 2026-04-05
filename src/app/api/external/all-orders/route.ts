import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { fetchExternalAllOrdersRaw } from "@/lib/external-all-orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/external/all-orders
 * Proxies provider all-orders — **admin only** (same data as wholesale API key).
 */
export async function GET(_request: NextRequest) {
  const adminCtx = await requireAdmin();
  if (!adminCtx.ok) {
    return adminCtx.response;
  }

  const rows = await fetchExternalAllOrdersRaw();
  return NextResponse.json(rows, { status: 200 });
}
