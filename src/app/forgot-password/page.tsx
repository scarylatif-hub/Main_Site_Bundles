"use client";

// src/app/forgot-password/page.tsx

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const normalizedEmail = email.trim().toLowerCase();
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
    const currentOrigin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirectBaseUrl = configuredAppUrl || currentOrigin;
    const redirectTo = redirectBaseUrl
      ? `${redirectBaseUrl}/reset-password`
      : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      console.error("Password reset email error:", {
        message: error.message,
        name: error.name,
        status: error.status,
        redirectTo,
      });
      setError(
        error.status && error.status >= 500
          ? "Supabase could not send the reset email. Please check your Supabase Auth email/SMTP settings and allowed redirect URLs."
          : error.message ||
              "Could not send the reset email. Please check the email address and try again."
      );
      return;
    }

    setEmail(normalizedEmail);
    setSuccess(true);
  };

  return (
    <div className="container max-w-md mx-auto px-4 py-16">
      <PageHeader
        title="Forgot Password"
        description="Enter your email and we'll send you a reset link."
      />

      <Card className="mt-8">
        <CardContent className="pt-6">
          {success ? (
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Password reset email sent. Check your inbox and follow the link
                to reset your password.
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
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="link" asChild>
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
