import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <div className="container max-w-lg mx-auto px-4 py-16 text-center">
      <PageHeader
        title="Forgot password"
        description="Password recovery is handled through Supabase. Contact support or use the link from your project auth settings."
      />
      <Button asChild className="mt-6">
        <Link href="/login">Back to login</Link>
      </Button>
    </div>
  );
}
