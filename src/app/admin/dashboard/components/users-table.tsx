"use client";

import {
    ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Profile } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";


export const columns: ColumnDef<Profile>[] = [
    {
        accessorKey: "full_name",
        header: "Full Name",
    },
    {
        accessorKey: "email",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Email
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
    },
    {
        accessorKey: "phone_number",
        header: "Phone",
    },
    {
        accessorKey: "wallet_balance",
        header: () => <div className="text-right">Balance</div>,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("wallet_balance"));
            const formatted = new Intl.NumberFormat("en-GH", {
                style: "currency",
                currency: "GHS",
            }).format(amount);

            return <div className="text-right font-medium">{formatted}</div>;
        },
    },
    {
        accessorKey: "is_admin",
        header: "Role",
        cell: ({ row }) => {
            const isAdmin = row.getValue("is_admin");
            return <Badge variant={isAdmin ? "secondary" : "outline"}>{isAdmin ? "Admin" : "User"}</Badge>;
        },
    },
];

export function UsersTable({ data }: { data: Profile[] }) {
    return <DataTable columns={columns} data={data} filterColumn="email" />;
}
