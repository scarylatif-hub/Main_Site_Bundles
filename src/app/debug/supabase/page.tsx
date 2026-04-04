"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SupabaseDebugPage() {
  const [status, setStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const result: Record<string, any> = {
          timestamp: new Date().toISOString(),
        };

        // Check Supabase URL and credentials
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        result.configuration = {
          url: url ? "✓ Configured" : "✗ Missing",
          anonKey: key ? `✓ Configured (${key.substring(0, 20)}...)` : "✗ Missing",
        };

        // Test REST API
        try {
          const restResponse = await fetch(`${url}/rest/v1/`, {
            headers: {
              apikey: key || "",
            },
          });
          result.restApi = {
            status: restResponse.status,
            ok: restResponse.ok,
          };
        } catch (err) {
          result.restApi = {
            error: String(err),
          };
        }

        // Test Auth API - check if already signed in
        try {
          const session = await supabase.auth.getSession();
          result.auth = {
            hasSession: !!session.data.session,
            user: session.data.session?.user?.email || "No user",
            error: session.error?.message || null,
          };
        } catch (err) {
          result.auth = {
            error: String(err),
          };
        }

        // Test GET tables
        try {
          const tableResponse = await fetch(
            `${url}/rest/v1/profiles?select=*&limit=1`,
            {
              headers: {
                apikey: key || "",
              },
            }
          );
          result.tables = {
            profiles: {
              status: tableResponse.status,
              ok: tableResponse.ok,
            },
          };
        } catch (err) {
          result.tables = {
            error: String(err),
          };
        }

        setStatus(result);
      } catch (error) {
        setStatus({
          error: String(error),
        });
      } finally {
        setLoading(false);
      }
    };

    checkSupabase();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Supabase Debug Panel</h1>

        {loading ? (
          <div className="text-yellow-400">Checking Supabase connectivity...</div>
        ) : (
          <pre className="bg-gray-800 p-6 rounded-lg overflow-auto text-sm font-mono border border-gray-700">
            {JSON.stringify(status, null, 2)}
          </pre>
        )}

        <div className="mt-8 p-4 bg-blue-900 rounded-lg text-sm">
          <p className="mb-2">
            <strong>Instructions:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>If REST API shows 200: ✓ Supabase is reachable</li>
            <li>
              If profiles table shows 200: ✓ Database schema is deployed
            </li>
            <li>Check browser console (F12) for detailed error messages</li>
            <li>
              If there are errors, note them down for troubleshooting
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
