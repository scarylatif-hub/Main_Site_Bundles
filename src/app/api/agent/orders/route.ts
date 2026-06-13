import { NextResponse } from "next/server";
import { getAgentStoreOrders, requireAgentJwt } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAgentJwt(request);
  if (auth instanceof NextResponse) return auth;

  const ordersResult = await getAgentStoreOrders(auth.storeId);
  if (!ordersResult.ok) {
    return NextResponse.json({ error: ordersResult.error }, { status: ordersResult.status });
  }

  return NextResponse.json({ orders: ordersResult.orders });
}
