import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStoreCreationRequested } from "@/lib/server/notifications";
import { createClient } from "@/lib/supabase/server";

// Keep creation math aligned with reseller pricing rules.
const BASE_ADMIN_1GB_PRICE = 4.29; // 3.85 console + 14% admin markup
const MIN_MARGIN = 0.093; // 9.3%
const MAX_MARGIN = 0.48;  // 48%

function isMissingColumnError(error: any): boolean {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "PGRST204" ||
    message.includes("could not find the") ||
    message.includes("column") && message.includes("does not exist")
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let storeName = "";
    let storeSlug = "";
    let oneGbPrice: number | null = null;
    let description = "";
    let contactNumber = "";
    let whatsappLink = "";
    let themeColor: string | null = null;
    let logoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      storeName = String(formData.get("storeName") || "").trim();
      storeSlug = String(formData.get("storeSlug") || "").trim();
      oneGbPrice = Number(formData.get("oneGbPrice"));
      description = String(formData.get("description") || "").trim();
      contactNumber = String(formData.get("contactNumber") || "").trim();
      whatsappLink = String(formData.get("whatsappLink") || "").trim();
      themeColor = String(formData.get("themeColor") || "").trim() || null;
      const file = formData.get("logo");
      logoFile = file instanceof File && file.size > 0 ? file : null;
    } else {
      const body = await req.json();
      storeName = String(body.storeName || "").trim();
      storeSlug = String(body.storeSlug || "").trim();
      oneGbPrice = Number(body.oneGbPrice);
      description = String(body.description || "").trim();
      contactNumber = String(body.contactNumber || "").trim();
      whatsappLink = String(body.whatsappLink || "").trim();
      themeColor = String(body.themeColor || "").trim() || null;
    }

    if (!storeName || !storeSlug) {
      return NextResponse.json(
        { error: "Store name and slug are required" },
        { status: 400 }
      );
    }

    if (oneGbPrice == null || Number.isNaN(Number(oneGbPrice)) || Number(oneGbPrice) <= 0) {
      return NextResponse.json(
        { error: "1GB price is required and must be greater than 0" },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9-]+$/.test(storeSlug)) {
      return NextResponse.json(
        {
          error:
            "Slug can only contain lowercase letters, numbers, and hyphens",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: existingSlug, error: existingSlugError } = await admin
      .from("profiles")
      .select("id")
      .eq("reseller_slug", storeSlug)
      .maybeSingle();

    if (existingSlugError) {
      console.error("Store slug lookup error:", existingSlugError);
      return NextResponse.json({ error: "Could not validate store slug" }, { status: 500 });
    }

    if (existingSlug) {
      return NextResponse.json(
        { error: "Store slug is already taken" },
        { status: 400 }
      );
    }

    let storeLogoUrl: string | null = null;
    if (logoFile) {
      const fileExt = logoFile.name.split(".").pop() || "png";
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `store-logos/${fileName}`;

      const { error: uploadError } = await admin.storage
        .from("store-logos")
        .upload(filePath, logoFile);

      if (uploadError && !uploadError.message?.includes("Bucket not found")) {
        console.error("Store logo upload error:", uploadError);
        return NextResponse.json({ error: "Failed to upload store logo" }, { status: 500 });
      }

      if (!uploadError) {
        const { data: publicUrlData } = admin.storage
          .from("store-logos")
          .getPublicUrl(filePath);
        storeLogoUrl = publicUrlData.publicUrl;
      }
    }

    const requestedOneGbPrice = Number(oneGbPrice);
    const rawDerivedMargin = requestedOneGbPrice / BASE_ADMIN_1GB_PRICE - 1;
    const computedProfitMargin = Number(
      Math.max(MIN_MARGIN, Math.min(MAX_MARGIN, rawDerivedMargin)).toFixed(4)
    );

    const baseProfileUpdateData: Record<string, unknown> = {
      store_name: storeName,
      reseller_slug: storeSlug,
      is_reseller: true,
      reseller_approved: false,
      store_active: true,
      profit_margin: computedProfitMargin,
      updated_at: new Date().toISOString(),
    };

    const { error: baseUpdateError } = await admin
      .from("profiles")
      .update(baseProfileUpdateData)
      .eq("id", user.id);

    if (baseUpdateError) {
      console.error("Store base creation error:", baseUpdateError);
      return NextResponse.json(
        { error: baseUpdateError.message || "Failed to create store" },
        { status: 500 }
      );
    }

    const optionalProfileUpdateData: Record<string, unknown> = {
      store_description: description || "We sell affordable Data Packages",
      contact_number: contactNumber || null,
      whatsapp_link: whatsappLink || null,
      store_theme_color: /^#[0-9a-fA-F]{6}$/.test(themeColor || "") ? themeColor : null,
      updated_at: new Date().toISOString(),
    };
    if (storeLogoUrl) {
      optionalProfileUpdateData.store_logo_url = storeLogoUrl;
    }

    if (Object.keys(optionalProfileUpdateData).length > 1) {
      const { error: optionalUpdateError } = await admin
        .from("profiles")
        .update(optionalProfileUpdateData)
        .eq("id", user.id);

      if (optionalUpdateError) {
        if (isMissingColumnError(optionalUpdateError)) {
          // Database is on an older schema; store still works without optional branding fields.
          console.warn("Optional store fields skipped due to missing DB columns.");
        } else {
          console.error("Optional store fields update error:", optionalUpdateError);
          // Do not fail store creation if optional fields fail.
        }
      }
    }

    // Keep compatibility with deployments that have one_gb_price column.
    const { error: oneGbPriceUpdateError } = await admin
      .from("profiles")
      .update({
        one_gb_price: Number(oneGbPrice),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (oneGbPriceUpdateError && !isMissingColumnError(oneGbPriceUpdateError)) {
      console.error("one_gb_price update error:", oneGbPriceUpdateError);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number")
      .eq("id", user.id)
      .single();

    try {
      await notifyStoreCreationRequested({
        userId: user.id,
        storeName,
        storeSlug,
        resellerName: profile?.full_name,
        email: profile?.email,
        phoneNumber: profile?.phone_number,
      });
    } catch (notifyError) {
      console.error("Store created but notification failed:", notifyError);
    }

    return NextResponse.json({
      success: true,
      message: "Store created successfully. Waiting for admin approval.",
      storeName,
      storeSlug,
    });
  } catch (error) {
    console.error("Store creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
