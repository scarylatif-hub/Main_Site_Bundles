"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthDebugPage() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("TestPassword123!");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any>>({});

  const testSignUp = async () => {
    setLoading(true);
    try {
      console.log("Testing signup with:", { email, password });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      const result = {
        timestamp: new Date().toISOString(),
        success: !error,
        error: error ? {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
        } : null,
        data: {
          userId: data?.user?.id,
          email: data?.user?.email,
          createdAt: data?.user?.created_at,
        },
      };

      console.log("Auth result:", result);
      setResult(result);
    } catch (err) {
      console.error("Error during signup:", err);
      setResult({
        timestamp: new Date().toISOString(),
        error: String(err),
        name: (err as any)?.name,
        message: (err as any)?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const testSignIn = async () => {
    setLoading(true);
    try {
      console.log("Testing signin with:", { email, password });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      const result = {
        timestamp: new Date().toISOString(),
        success: !error,
        error: error ? {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
        } : null,
        data: {
          userId: data?.user?.id,
          email: data?.user?.email,
        },
      };

      console.log("Auth result:", result);
      setResult(result);
    } catch (err) {
      console.error("Error during signin:", err);
      setResult({
        timestamp: new Date().toISOString(),
        error: String(err),
        name: (err as any)?.name,
        message: (err as any)?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Supabase Auth Debug</h1>

        <Card className="mb-8 bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Test Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
                className="bg-gray-700 border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="TestPassword123!"
                className="bg-gray-700 border-gray-600"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={testSignUp}
                disabled={loading}
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Testing..." : "Test Sign Up"}
              </Button>
              <Button
                onClick={testSignIn}
                disabled={loading}
                variant="outline"
                className="border-blue-600 text-blue-400 hover:bg-blue-600"
              >
                {loading ? "Testing..." : "Test Sign In"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-900 p-4 rounded overflow-auto text-xs font-mono border border-gray-700">
              {JSON.stringify(result, null, 2) || "No result yet..."}
            </pre>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-yellow-900 rounded-lg text-sm">
          <p className="mb-2">
            <strong>Troubleshooting Steps:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open developer console (F12) to see detailed error logs</li>
            <li>
              Check the Result panel above for error details from Supabase
            </li>
            <li>
              If "Failed to fetch": Supabase API may be unreachable or network
              issue
            </li>
            <li>
              If successful: Database schema is working properly
            </li>
            <li>
              Compare error codes with Supabase documentation
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
