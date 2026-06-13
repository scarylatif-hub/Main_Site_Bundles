import { NextResponse } from "next/server";
import { getAgentStoreProfile, requireAgentJwt } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAgentJwt(request);
  if (auth instanceof NextResponse) return auth;

  const profileResult = await getAgentStoreProfile(auth.storeId);
  if (!profileResult.ok) {
    return NextResponse.json({ error: profileResult.error }, { status: profileResult.status });
  }

  return NextResponse.json({ profile: profileResult.profile });
}
