import { NextResponse } from "next/server";
import { getAgentStoreCustomers, requireAgentJwt } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAgentJwt(request);
  if (auth instanceof NextResponse) return auth;

  const customers = await getAgentStoreCustomers(auth.storeId);
  return NextResponse.json({ customers });
}
