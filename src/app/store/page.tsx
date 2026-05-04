"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, ExternalLink } from "lucide-react";

export default function StorePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Store Portal</CardTitle>
          <CardDescription>
            Welcome to our store platform. Please access a specific store.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              To visit a store, you need the store's unique URL.
            </p>
            <p className="text-xs text-muted-foreground">
              Example: <code className="bg-muted px-1 py-0.5 rounded">/store/your-store-name</code>
            </p>
          </div>
          
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push("https://sbbundles.vercel.app")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit Main Website
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
