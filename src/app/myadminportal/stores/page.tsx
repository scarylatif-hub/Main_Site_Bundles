import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminStoresPage() {
  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/");
  }

  const { data: stores, error } = await admin
    .from("profiles")
    .select("*")
    .eq("is_reseller", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin stores error:", error);
  }

  const pendingStores = stores?.filter((s) => !s.reseller_approved) ?? [];
  const approvedStores = stores?.filter((s) => s.reseller_approved) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Store Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage reseller store applications and approvals.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals ({pendingStores.length})</CardTitle>
            <CardDescription>
              Stores waiting for your approval to start selling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingStores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending approvals.</p>
            ) : (
              <div className="space-y-4">
                {pendingStores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center justify-between border rounded-lg p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{store.store_name}</p>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {store.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        URL: /store/{store.reseller_slug}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={`/api/admin/stores/${store.id}/approve`} method="POST">
                        <input type="hidden" name="approved" value="true" />
                        <Button type="submit" size="sm">Approve</Button>
                      </form>
                      <form action={`/api/admin/stores/${store.id}/approve`} method="POST">
                        <input type="hidden" name="approved" value="false" />
                        <Button type="submit" size="sm" variant="outline">Reject</Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approved Stores */}
        <Card>
          <CardHeader>
            <CardTitle>Approved Stores ({approvedStores.length})</CardTitle>
            <CardDescription>
              Active reseller stores on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {approvedStores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approved stores yet.</p>
            ) : (
              <div className="space-y-4">
                {approvedStores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center justify-between border rounded-lg p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{store.store_name}</p>
                        <Badge variant="default">Active</Badge>
                        {!store.store_active && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {store.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        URL: /store/{store.reseller_slug}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={`/api/admin/stores/${store.id}/approve`} method="POST">
                        <input type="hidden" name="approved" value="false" />
                        <Button type="submit" size="sm" variant="outline">Deactivate</Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
