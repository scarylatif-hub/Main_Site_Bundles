import { NextResponse } from "next/server";
import { fetchAgentPackages, requireAgentApiKey } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiError = requireAgentApiKey(request);
  if (apiError) return apiError;

  const packages = await fetchAgentPackages();
  if (!packages.ok) {
    return NextResponse.json({ error: packages.error }, { status: 502 });
  }

  return NextResponse.json({ packages: packages.packages });
}
