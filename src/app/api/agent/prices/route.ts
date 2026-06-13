import { NextResponse } from "next/server";
import { buildAgentStorePrices, requireAgentJwt } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAgentJwt(request);
  if (auth instanceof NextResponse) return auth;

  const priceResult = await buildAgentStorePrices(auth.storeId);
  if (!priceResult.ok) {
    return NextResponse.json({ error: priceResult.error }, { status: priceResult.status });
  }

  return NextResponse.json({ packages: priceResult.packages });
}
