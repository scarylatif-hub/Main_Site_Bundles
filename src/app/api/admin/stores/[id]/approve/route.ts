import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-config";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = createAdminClient();
    const { data: { user } } = await admin.auth.getUser();

    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    
    // Parse FormData or JSON
    let approved: boolean;
    const contentType = req.headers.get("content-type");
    
    if (contentType?.includes("application/json")) {
      const body = await req.json();
      approved = body.approved;
    } else {
      const formData = await req.formData();
      const approvedValue = formData.get("approved");
      approved = approvedValue === "true";
    }

    if (typeof approved !== "boolean") {
      return NextResponse.json({ error: "approved must be a boolean" }, { status: 400 });
    }

    // Update store approval status
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        reseller_approved: approved,
        store_active: approved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Store approval error:", updateError);
      return NextResponse.json({ error: "Failed to update store" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: approved ? "Store approved" : "Store rejected",
    });
  } catch (error) {
    console.error("Store approval error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
