import { createAdminClient } from "@/lib/supabase/admin";
import { AdminUsersClient } from "./admin-users-client";

export const dynamic = "force-dynamic";

export default async function MyAdminUsersPage() {
  const admin = createAdminClient();
  const { data: users, error } = await admin
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set exact balance, add/subtract with adjustments (negative deducts), or
          remove accounts (except the primary admin).
        </p>
      </div>
      <AdminUsersClient users={users || []} />
    </div>
  );
}
