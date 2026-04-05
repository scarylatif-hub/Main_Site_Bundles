import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-config";

export default async function MyAdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/myadminportal/dashboard");
  }

  if (!isAdminEmail(user.email)) {
    redirect("/");
  }

  return (
    <div className="min-h-full flex flex-col bg-muted/30">
      <header className="shrink-0 border-b bg-background px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Admin portal
        </p>
        <p className="text-sm font-semibold truncate">{user.email}</p>
      </header>
      <div className="flex-1 min-w-0 p-4 md:p-8">{children}</div>
    </div>
  );
}
