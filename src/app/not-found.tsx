import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        This page is not available on the store site. Open your reseller&apos;s
        store link to buy data bundles.
      </p>
      <Button asChild className="mt-6">
        <Link href="/store">Go to store portal</Link>
      </Button>
    </div>
  );
}
