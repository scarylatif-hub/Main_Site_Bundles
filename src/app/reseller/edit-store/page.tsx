"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function EditStorePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [themeColor, setThemeColor] = useState("#000000");
  const [contactNumber, setContactNumber] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (userProfile) {
      setStoreName(userProfile.store_name || "");
      setDescription(userProfile.store_description || "We sell affordable Data Packages");
      setThemeColor(userProfile.store_theme_color || "#000000");
      setContactNumber(userProfile.contact_number || "");
      setWhatsappLink(userProfile.whatsapp_link || "");
    }
  }, [userProfile]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("storeName", storeName);
      formData.append("description", description);
      formData.append("themeColor", themeColor);
      formData.append("contactNumber", contactNumber);
      formData.append("whatsappLink", whatsappLink);

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const res = await fetch("/api/reseller/edit-store", {
        method: "PATCH",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update store");
      }

      toast({
        title: "Store Updated",
        description: "Your store has been updated successfully.",
      });

      router.push("/reseller/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update store",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!userProfile?.is_reseller) {
    router.push("/profile");
    return null;
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Edit Store"
        description="Update your store information and settings"
      />

      <Card>
        <CardHeader>
          <CardTitle>Edit Store</CardTitle>
          <CardDescription>
            Update your store details to customize your storefront
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Store Name */}
            <div>
              <Label htmlFor="storeName">Store Name *</Label>
              <Input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="SB-Bundles"
                required
                className="mt-1.5"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="We sell affordable Data Packages"
                rows={3}
                className="mt-1.5"
              />
            </div>

            {/* Store Logo */}
            <div>
              <Label htmlFor="logo">Store Logo</Label>
              {userProfile?.store_logo_url && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-2">Current Logo</p>
                  <img
                    src={userProfile.store_logo_url}
                    alt="Current store logo"
                    className="h-20 w-20 rounded-md border object-contain bg-white"
                  />
                </div>
              )}
              <div className="mt-2">
                <Label htmlFor="logoUpload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                    <span>Update Logo</span>
                  </div>
                </Label>
                <Input
                  id="logoUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                {logoFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {logoFile.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to keep current logo
                </p>
              </div>
            </div>

            {/* Theme Color */}
            <div>
              <Label htmlFor="themeColor">Theme Color</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  id="themeColor"
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-20 h-10 p-1"
                />
                <Input
                  type="text"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Contact Number */}
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="0595919802"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be visible on your store page.
              </p>
            </div>

            {/* WhatsApp Link */}
            <div>
              <Label htmlFor="whatsappLink">WhatsApp Link</Label>
              <Input
                id="whatsappLink"
                value={whatsappLink}
                onChange={(e) => setWhatsappLink(e.target.value)}
                placeholder="https://wa.me/233595919802"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use a full link so customers can open WhatsApp directly.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Updating..." : "Update Store"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/reseller/dashboard")}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
