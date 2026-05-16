"use client";

// src/app/reset-password/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation"; // app router — NOT next/router
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    // Use browser client — never import from @/lib/supabase/server in client components
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => router.push("/login"), 3000);
    }
  };

  return (
    <div className="container max-w-md mx-auto px-4 py-16">
      <PageHeader
        title="Reset Password"
        description="Enter your new password below."
      />

      <Card className="mt-8">
        <CardContent className="pt-6">
          {success ? (
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Password updated successfully! Redirecting you to login...
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Remembered your password?{" "}
          <Button variant="link" className="px-1 h-auto" asChild>
            <a href="/login">Login</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}