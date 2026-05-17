"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { sanitizeSearchParamsString } from "@/lib/sanitize-auth-search-params";
import { useAuth } from "@/context/auth-context";

const FormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

function LoginForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    const raw = searchParams.toString();
    const { cleaned, changed } = sanitizeSearchParamsString(raw);
    if (changed) {
      const next = cleaned ? `/login?${cleaned}` : "/login";
      window.history.replaceState(null, "", next);
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || !user) return;
    const target = safeNextPath();
    window.location.replace(target);
  }, [authLoading, user, searchParams]);

  function safeNextPath(): string {
    const raw = searchParams.get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
      return raw;
    }
    return "/";
  }

  if (!authLoading && user) {
    return (
      <Card className="w-full max-w-md p-8 text-center text-muted-foreground">
        Redirecting…
      </Card>
    );
  }

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch("/api/auth/signin", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
          }),
        });
      } catch {
        throw new Error(
          "Could not reach the server. Check your connection and try again."
        );
      }

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" && body.error
            ? body.error
            : "Invalid email or password."
        );
      }

      window.location.assign(safeNextPath());
    } catch (error: unknown) {
      console.error("Login Error:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description:
          error instanceof Error
            ? error.message
            : "Invalid email or password. Please try again.",
      });
      setLoading(false); // only reset on error — on success we're navigating away
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold tracking-tight">
          Welcome Back
        </CardTitle>
        <CardDescription>Login to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            method="post"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="your.email@example.com"
                      {...field}
                      autoComplete="username"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
        <p><a href="/forgot-password">Forgot Password?</a></p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] w-full items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <Card className="w-full max-w-md p-8 text-center text-muted-foreground">
            Loading…
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
