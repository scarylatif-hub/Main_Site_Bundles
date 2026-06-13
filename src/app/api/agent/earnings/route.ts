import { NextResponse } from "next/server";
import { getAgentEarningsSummary, requireAgentJwt } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAgentJwt(request);
  if (auth instanceof NextResponse) return auth;

  const result = await getAgentEarningsSummary(auth.storeId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ earnings: result.earnings });
}
