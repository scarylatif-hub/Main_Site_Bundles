"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PageHeader } from "@/components/page-header";
import { toast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Smartphone,
} from "lucide-react";

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  momo_number: string | null;
  status: string;
  created_at: string;
  processed_at: string | null;
  reference: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
  };
};

export default function AdminWithdrawalsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchWithdrawals();
    }
  }, [user]);

  const fetchWithdrawals = async () => {
    try {
      const res = await fetch("/api/admin/withdrawals");
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleStatusUpdate = async (withdrawalId: string, status: string) => {
    setProcessing(withdrawalId);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId, status }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update withdrawal");
      }

      toast({ title: "Success", description: data.message });
      fetchWithdrawals();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to update withdrawal", 
        variant: "destructive" 
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge className="gap-1 bg-green-600 text-white">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="gap-1 bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Withdrawal Requests"
        description="Manage store owner withdrawal requests"
      />

      <Card>
        <CardHeader>
          <CardTitle>All Withdrawals</CardTitle>
          <CardDescription>
            Review and process withdrawal requests from store owners
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="text-center py-12">Loading...</div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No withdrawal requests yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store Owner</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>MoMo Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div>{format(new Date(withdrawal.created_at), "MMM d")}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(withdrawal.created_at), "h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{withdrawal.profiles.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {withdrawal.profiles.email || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">
                        ₵{withdrawal.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          <span className="font-mono text-sm">{withdrawal.momo_number || "—"}</span>
                        </div>
                        {withdrawal.reference && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Ref: {withdrawal.reference}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                      <TableCell className="text-right">
                        {withdrawal.status === "pending" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={processing === withdrawal.id}>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(withdrawal.id, "completed")}
                                disabled={processing === withdrawal.id}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Complete
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(withdrawal.id, "rejected")}
                                disabled={processing === withdrawal.id}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
