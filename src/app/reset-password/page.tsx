"use client";

// src/app/reset-password/page.tsx

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash
    // e.g. /reset-password#access_token=xxx&type=recovery
    // We listen for the PASSWORD_RECOVERY event which fires automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          // Session is established from the recovery link — ready to update password
          setSessionReady(true);
          setVerifying(false);
        } else if (event === "SIGNED_IN" && session) {
          setSessionReady(true);
          setVerifying(false);
        }
      }
    );

    // Fallback: check if there's already an active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
        setVerifying(false);
      } else {
        // Give the onAuthStateChange listener 3 seconds to fire
        setTimeout(() => {
          setVerifying(false);
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    } else {
      setSuccess(true);
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
          {verifying ? (
            <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Verifying your reset link...</p>
            </div>
          ) : success ? (
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Password updated successfully! Redirecting you to login...
              </AlertDescription>
            </Alert>
          ) : !sessionReady ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This reset link is invalid or has expired. Please{" "}
                <a href="/forgot-password" className="underline font-medium">
                  request a new one
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