import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PricingClient from "./pricing-client";

export const dynamic = "force-dynamic";

export default async function ResellerPricingPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!userProfile?.is_reseller) {
    redirect("/profile");
  }

  const currentMarkup = Number(userProfile.profit_margin || 0.05);

  return <PricingClient userId={user.id} currentMarkup={currentMarkup} />;
}
