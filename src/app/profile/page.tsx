"use client";

// src/app/profile/page.tsx

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AVATAR_OPTIONS, buildAvatarUrl } from "@/lib/avatars";
import type { Profile } from "@/context/auth-context";

export default function ProfilePage() {
  const { user, userProfile, loading, logout, refreshUser } = useAuth();
  const router = useRouter();

  // Local copy of profile so avatar updates are instant without waiting for refreshUser
  const [localProfile, setLocalProfile] = useState<Profile | null>(null);
  const [savingAvatarId, setSavingAvatarId]   = useState<string | null>(null);
  const [avatarError, setAvatarError]         = useState<string | null>(null);

  useEffect(() => {
    setLocalProfile(userProfile);
  }, [userProfile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const avatarUrl = useMemo(
    () => localProfile?.avatar_url ?? buildAvatarUrl("default"),
    [localProfile?.avatar_url]
  );

  const selectedAvatarUrl = localProfile?.avatar_url ?? "";

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  const displayName =
    userProfile?.full_name ||
    user.user_metadata?.full_name ||
    "User";

  const saveAvatar = async (nextAvatarUrl: string, avatarId: string) => {
    if (!user) return;
    if (selectedAvatarUrl === nextAvatarUrl) return;
    if (savingAvatarId) return;

    const previousAvatarUrl = selectedAvatarUrl;
    setAvatarError(null);
    setSavingAvatarId(avatarId);

    // Optimistic update — show the new avatar immediately
    setLocalProfile((prev) =>
      prev ? { ...prev, avatar_url: nextAvatarUrl } : prev
    );

    try {
      const res = await fetch("/api/auth/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatar_url: nextAvatarUrl }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error || "Failed to save avatar"
        );
      }

      // Sync auth context so header updates too
      refreshUser();
    } catch (e) {
      // Roll back optimistic update on failure
      setLocalProfile((prev) =>
        prev ? { ...prev, avatar_url: previousAvatarUrl || null } : prev
      );
      setAvatarError(
        e instanceof Error ? e.message : "Could not save avatar. Please try again."
      );
    } finally {
      setSavingAvatarId(null);
    }
  };

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
              <img
                src={avatarUrl}
                alt={`${displayName}'s avatar`}
                className="w-24 h-24 rounded-full border-2 border-border"
              />
              <div>
                <CardTitle className="text-3xl">{displayName}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Avatar picker */}
            <div>
              <h3 className="font-semibold text-sm">Choose Avatar</h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Click any avatar to update your profile picture.
              </p>
              <div className="grid grid-cols-6 gap-3">
                {AVATAR_OPTIONS.map((avatar) => {
                  const optionUrl  = buildAvatarUrl(avatar.seed);
                  const isSelected = selectedAvatarUrl === optionUrl;
                  const isSaving   = savingAvatarId === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => saveAvatar(optionUrl, avatar.id)}
                      disabled={Boolean(savingAvatarId)}
                      aria-label={`Select ${avatar.label} avatar`}
                      className={[
                        "h-12 w-12 rounded-full overflow-hidden border-2 transition-all",
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 scale-110"
                          : "border-border hover:border-primary/60 hover:scale-105",
                        isSaving ? "opacity-50 cursor-wait" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <img
                        src={optionUrl}
                        alt={avatar.label}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
              {avatarError && (
                <p className="text-xs text-destructive mt-2">{avatarError}</p>
              )}
            </div>

            <hr />

            {/* Account info */}
            <div>
              <h3 className="font-semibold text-sm">Account Information</h3>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1.5">
                <li>
                  <span className="font-medium text-foreground">Full Name: </span>
                  {userProfile?.full_name ?? "—"}
                </li>
                <li>
                  <span className="font-medium text-foreground">Email: </span>
                  {user.email}
                </li>
                <li>
                  <span className="font-medium text-foreground">Phone: </span>
                  {userProfile?.phone_number ?? "—"}
                </li>
              </ul>
            </div>

            <hr />

            {/* Danger zone */}
            <div>
              <h3 className="font-semibold text-sm text-destructive">
                Danger Zone
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Log out of your account on this device.
              </p>
              <Button variant="outline" onClick={logout}>
                Log out
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}