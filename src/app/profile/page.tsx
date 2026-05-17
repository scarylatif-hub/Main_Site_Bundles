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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AVATAR_OPTIONS, buildAvatarUrl } from "@/lib/avatars";
import type { Profile } from "@/lib/definitions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function ProfilePageContent() {
  const { user, userProfile, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [localProfile, setLocalProfile] = useState<Profile | null>(null);
  const [savingAvatarId, setSavingAvatarId] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [oneGbPrice, setOneGbPrice] = useState("");
  const [storeDescription, setStoreDescription] = useState("We sell affordable Data Packages");
  const [contactNumber, setContactNumber] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [storeThemeColor, setStoreThemeColor] = useState("#000000");
  const [storeLogoFile, setStoreLogoFile] = useState<File | null>(null);
  const [creatingStore, setCreatingStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeSuccess, setStoreSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLocalProfile(userProfile);
  }, [userProfile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || userProfile?.is_reseller) {
      return;
    }

    if (searchParams.get("createStore") === "1") {
      setStoreModalOpen(true);
    }
  }, [loading, searchParams, user, userProfile?.is_reseller]);

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

    setLocalProfile((prev: Profile | null) =>
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

      refreshUser();
    } catch (e) {
      setLocalProfile((prev: Profile | null) =>
        prev ? { ...prev, avatar_url: previousAvatarUrl || undefined } : prev
      );
      setAvatarError(
        e instanceof Error ? e.message : "Could not save avatar. Please try again."
      );
    } finally {
      setSavingAvatarId(null);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !storeSlug || !oneGbPrice) return;

    setCreatingStore(true);
    setStoreError(null);
    setStoreSuccess(null);

    try {
      const formData = new FormData();
      formData.append("storeName", storeName);
      formData.append("storeSlug", storeSlug);
      formData.append("oneGbPrice", oneGbPrice);
      formData.append("description", storeDescription);
      formData.append("contactNumber", contactNumber);
      formData.append("whatsappLink", whatsappLink);
      if (storeThemeColor) formData.append("themeColor", storeThemeColor);
      if (storeLogoFile) formData.append("logo", storeLogoFile);

      const res = await fetch("/api/reseller/create-store", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create store");

      setStoreSuccess(data.message);
      setStoreModalOpen(false);
      setStoreName("");
      setStoreSlug("");
      setOneGbPrice("");
      setStoreDescription("We sell affordable Data Packages");
      setContactNumber("");
      setWhatsappLink("");
      setStoreThemeColor("#000000");
      setStoreLogoFile(null);
      refreshUser();
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : "Failed to create store");
    } finally {
      setCreatingStore(false);
    }
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 50);

  const handleStoreNameChange = (value: string) => {
    setStoreName(value);
    setStoreSlug(generateSlug(value));
  };

  const handleStoreSlugChange = (value: string) => {
    setStoreSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50));
  };

  const storeDomain = process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app";
  const storeUrl = storeSlug
    ? `https://${storeDomain}/store/${storeSlug}`
    : "/store/your-slug";

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:py-12">
      <PageHeader
        title="My Profile"
        description="View and manage your account details."
      />

      <div className="mt-6 sm:mt-8">
        <Card>
          {/* ── Profile header ── */}
          <CardHeader className="pb-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <img
                src={avatarUrl}
                alt={`${displayName}'s avatar`}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-border shrink-0"
              />
              <div className="text-center sm:text-left min-w-0">
                <CardTitle className="text-2xl sm:text-3xl break-words">{displayName}</CardTitle>
                <CardDescription className="break-all">{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* ── Avatar picker ── */}
            <div>
              <h3 className="font-semibold text-sm">Choose Avatar</h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Tap any avatar to update your profile picture.
              </p>
              {/* 5 cols on mobile → 6 on sm+ */}
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 sm:gap-3">
                {AVATAR_OPTIONS.map((avatar) => {
                  const optionUrl = buildAvatarUrl(avatar.seed);
                  const isSelected = selectedAvatarUrl === optionUrl;
                  const isSaving = savingAvatarId === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => saveAvatar(optionUrl, avatar.id)}
                      disabled={Boolean(savingAvatarId)}
                      aria-label={`Select ${avatar.label} avatar`}
                      className={[
                        "aspect-square w-full rounded-full overflow-hidden border-2 transition-all",
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

            {/* ── Store section ── */}
            <div>
              <h3 className="font-semibold text-sm">My Store</h3>
              {storeSuccess && (
                <p className="text-xs text-green-600 mt-2">{storeSuccess}</p>
              )}
              {storeError && (
                <p className="text-xs text-destructive mt-2">{storeError}</p>
              )}

              {!userProfile?.is_reseller ? (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-3">
                    Create a store to start selling data bundles and earning commission.
                  </p>
                  <Dialog open={storeModalOpen} onOpenChange={setStoreModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto">Create Store</Button>
                    </DialogTrigger>

                    {/* ScrollArea so the form never clips on small screens */}
                    <DialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create Your Store</DialogTitle>
                        <DialogDescription>
                          Set up your store name and URL. Your store will be pending approval.
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={handleCreateStore} className="space-y-4 pt-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="storeName">Store Name</Label>
                          <Input
                            id="storeName"
                            value={storeName}
                            onChange={(e) => handleStoreNameChange(e.target.value)}
                            placeholder="My Data Store"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="storeSlug">Store URL Slug</Label>
                          <Input
                            id="storeSlug"
                            value={storeSlug}
                            onChange={(e) => handleStoreSlugChange(e.target.value)}
                            placeholder="my-data-store"
                            required
                            title="Only lowercase letters, numbers, and hyphens allowed"
                          />
                          {/* URL preview — truncate long slugs gracefully */}
                          <p className="text-xs text-muted-foreground break-all">
                            Your store URL:{" "}
                            <span className="font-medium">{storeUrl}</span>
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="oneGbPrice">Price per 1 GB (GHS)</Label>
                          <Input
                            id="oneGbPrice"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={oneGbPrice}
                            onChange={(e) => setOneGbPrice(e.target.value)}
                            placeholder="5.29"
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Used to calculate your profit margin automatically.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="storeDescription">Description <span className="text-muted-foreground">(optional)</span></Label>
                          <Textarea
                            id="storeDescription"
                            value={storeDescription}
                            onChange={(e) => setStoreDescription(e.target.value)}
                            placeholder="We sell affordable Data Packages"
                            rows={3}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="contactNumber">Contact Number <span className="text-muted-foreground">(optional)</span></Label>
                          <Input
                            id="contactNumber"
                            value={contactNumber}
                            onChange={(e) => setContactNumber(e.target.value)}
                            placeholder="0595919802"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="whatsappLink">WhatsApp Link <span className="text-muted-foreground">(optional)</span></Label>
                          <Input
                            id="whatsappLink"
                            value={whatsappLink}
                            onChange={(e) => setWhatsappLink(e.target.value)}
                            placeholder="https://wa.me/233595919802"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="storeThemeColor">Store Color <span className="text-muted-foreground">(optional)</span></Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="storeThemeColor"
                              type="color"
                              value={storeThemeColor}
                              onChange={(e) => setStoreThemeColor(e.target.value)}
                              className="h-10 w-14 p-1 shrink-0"
                            />
                            <Input
                              value={storeThemeColor}
                              onChange={(e) => setStoreThemeColor(e.target.value)}
                              placeholder="#000000"
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="storeLogo">Store Logo <span className="text-muted-foreground">(optional)</span></Label>
                          <Input
                            id="storeLogo"
                            type="file"
                            accept="image/*"
                            onChange={(e) => setStoreLogoFile(e.target.files?.[0] ?? null)}
                          />
                          {storeLogoFile && (
                            <p className="text-xs text-muted-foreground">
                              Selected: {storeLogoFile.name}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStoreModalOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={creatingStore}
                            className="w-full sm:w-auto"
                          >
                            {creatingStore ? "Creating…" : "Create Store"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {/* Stack label+value vertically on very small screens */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                    <span className="text-sm font-medium">Store Name</span>
                    <span className="text-sm text-muted-foreground">{userProfile?.store_name || "—"}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5">
                    <span className="text-sm font-medium shrink-0">Store URL</span>
                    <span className="text-sm text-muted-foreground break-all text-left sm:text-right">
                      {userProfile?.reseller_slug
                        ? `https://${storeDomain}/store/${userProfile.reseller_slug}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                    <span className="text-sm font-medium">Status</span>
                    <span className={`text-sm font-medium ${userProfile?.reseller_approved ? "text-green-600" : "text-yellow-600"}`}>
                      {userProfile?.reseller_approved ? "Approved" : "Pending Approval"}
                    </span>
                  </div>

                  {userProfile?.reseller_approved && userProfile?.store_active && (
                    <div className="space-y-2 pt-2">
                      <Button asChild className="w-full">
                        <a href="/reseller/dashboard">Store Dashboard</a>
                      </Button>
                      <Button asChild variant="outline" className="w-full">
                        <a href={`/store/${userProfile.reseller_slug}`}>Visit My Store</a>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <hr />

            {/* ── Account info ── */}
            <div>
              <h3 className="font-semibold text-sm">Account Information</h3>
              <ul className="text-sm text-muted-foreground mt-2 space-y-2">
                <li className="flex flex-col sm:flex-row sm:gap-1">
                  <span className="font-medium text-foreground">Full Name:</span>
                  <span>{userProfile?.full_name ?? "—"}</span>
                </li>
                <li className="flex flex-col sm:flex-row sm:gap-1">
                  <span className="font-medium text-foreground">Email:</span>
                  <span className="break-all">{user.email}</span>
                </li>
                <li className="flex flex-col sm:flex-row sm:gap-1">
                  <span className="font-medium text-foreground">Phone:</span>
                  <span>{userProfile?.phone_number ?? "—"}</span>
                </li>
              </ul>
            </div>

            <hr />

            {/* ── Danger zone ── */}
            <div>
              <h3 className="font-semibold text-sm text-destructive">Danger Zone</h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Log out of your account on this device.
              </p>
              <Button variant="outline" onClick={logout} className="w-full sm:w-auto">
                Log out
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          <div>Loading...</div>
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
