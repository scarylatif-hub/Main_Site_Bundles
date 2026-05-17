"use client";

// src/app/reset-password/page.tsx

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

function getHashParams() {
  if (typeof window === "undefined" || !window.location.hash) {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    const markReady = () => {
      if (!active) return;
      setSessionReady(true);
      setError("");
    };

    const markInvalid = (message: string) => {
      if (!active) return;
      setSessionReady(false);
      setError(message);
    };

    const verifyResetLink = async () => {
      setVerifying(true);

      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const hashParams = getHashParams();
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          markInvalid("This reset link is invalid or has expired. Please request a new one.");
        } else {
          markReady();
        }
        if (active) setVerifying(false);
        return;
      }

      if (tokenHash && type === "recovery") {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (error || !data.session) {
          markInvalid("This reset link is invalid or has expired. Please request a new one.");
        } else {
          await supabase.auth.setSession(data.session);
          markReady();
        }
        if (active) setVerifying(false);
        return;
      }

      if (accessToken && refreshToken && (!hashType || hashType === "recovery")) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          markInvalid("This reset link is invalid or has expired. Please request a new one.");
        } else {
          markReady();
        }
        if (active) setVerifying(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        markReady();
      } else {
        markInvalid("Invalid reset link. Please check your email or request a new one.");
      }

      if (active) setVerifying(false);
    };

    void verifyResetLink();

    return () => {
      active = false;
    };
  }, [searchParams]);

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

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 3000);
  };

  return (
    <div className="container max-w-md mx-auto px-4 py-16">
      <PageHeader
        title="Reset Password"
        description="Enter your new password below."
      />

      <Card className="mt-8">
        <CardContent className="pt-6">
          {verifying ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Verifying your reset link...</p>
            </div>
          ) : success ? (
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Password updated successfully. Redirecting you to login...
              </AlertDescription>
            </Alert>
          ) : !sessionReady ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || "This reset link is invalid or has expired."}{" "}
                <a href="/forgot-password" className="underline font-medium">
                  Request a new one
                </a>
                .
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
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-md mx-auto px-4 py-16">
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
