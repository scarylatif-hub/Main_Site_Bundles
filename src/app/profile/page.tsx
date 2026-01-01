
"use client";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  const displayName = userProfile?.full_name || user.user_metadata.full_name || "User";

  const userInitials =
    displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ||
    user.email?.[0].toUpperCase() ||
    "U";

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <PageHeader
        title="My Profile"
        description="View and manage your account details."
      />

      <div className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.user_metadata.avatar_url || ""} alt={displayName} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-3xl">{displayName}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold">Account Information</h3>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li><span className="font-medium text-foreground">Full Name:</span> {userProfile?.full_name}</li>
                <li><span className="font-medium text-foreground">Email:</span> {user.email}</li>
                <li><span className="font-medium text-foreground">Phone:</span> {userProfile?.phone_number}</li>
              </ul>
            </div>
            <hr />
            <div>
              <h3 className="font-semibold text-destructive">Danger Zone</h3>
              <p className="text-sm text-muted-foreground">
                Log out of your account.
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={logout}>
                    Logout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
