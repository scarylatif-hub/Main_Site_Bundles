import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get user profile
  const { data: profile } = await admin
    .from("profiles")
    .select("is_reseller")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  const formData = await req.formData();
  const storeName = formData.get("storeName") as string;
  const description = formData.get("description") as string;
  const themeColor = formData.get("themeColor") as string;
  const contactNumber = formData.get("contactNumber") as string;
  const whatsappLink = formData.get("whatsappLink") as string;
  const logoFile = formData.get("logo") as File | null;

  // Handle logo upload if provided
  let logoUrl = null;
  if (logoFile && logoFile.size > 0) {
    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `store-logos/${fileName}`;

      const { data: uploadData, error: uploadError } = await admin.storage
        .from("store-logos")
        .upload(filePath, logoFile);

      if (uploadError) {
        console.error("Logo upload error:", uploadError);
        return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
      }

      const { data: publicUrlData } = admin.storage
        .from("store-logos")
        .getPublicUrl(filePath);

      logoUrl = publicUrlData.publicUrl;
    } catch (error) {
      console.error("Logo upload error:", error);
      return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
    }
  }

  // Update profile
  const updateData: any = {
    store_name: storeName,
    store_description: description,
    theme_color: themeColor,
    contact_number: contactNumber,
    whatsapp_link: whatsappLink,
  };

  if (logoUrl) {
    updateData.store_logo = logoUrl;
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (updateError) {
    console.error("Update error:", updateError);
    return NextResponse.json({ error: "Failed to update store" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
