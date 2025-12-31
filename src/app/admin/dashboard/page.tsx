import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Transaction, Profile } from "@/lib/definitions";
import { DashboardClient } from "./components/dashboard-client";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";


async function getTransactions(supabase: any): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { descending: true });

  if (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }

  return data;
}

async function getUsers(supabase: any): Promise<Profile[]> {
    const { data, error } = await supabase.from("profiles").select("*");

    if (error) {
        console.error("Error fetching users with admin client:", error);
        return [];
    }

    return data;
}

export default async function AdminDashboard() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session || session.user.email !== "stevekobbi20@gmail.com") {
    redirect("/");
  }

  const transactions = await getTransactions(supabase);
  const users = await getUsers(supabase);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <DashboardClient users={users} transactions={transactions} />
    </div>
  );
}
