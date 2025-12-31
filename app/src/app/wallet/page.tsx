
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Transaction } from '@/lib/definitions';

export default function WalletPage() {
    const { user, loading, userProfile } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const { toast } = useToast();

    const fetchTransactions = useCallback(async () => {
        if (!user) return;
        
        const { data: transactionsData, error: transactionsError } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (transactionsError) {
            console.error('Error fetching transactions:', transactionsError.message || transactionsError);
            toast({ title: 'Error', description: 'Could not fetch transaction history.', variant: 'destructive'});
        } else {
            setTransactions(transactionsData || []);
        }
    }, [user, toast]);
    
    useEffect(() => {
        if (user) {
            fetchTransactions();
        }
    }, [user, fetchTransactions]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
            </div>
        );
    }

    if (!user) {
         return (
            <div className="flex justify-center items-center h-screen">
                <div>Please log in to view your wallet.</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
            <PageHeader
                title="My Wallet"
                description="Manage your balance and view your transaction history."
            />

            <div className="mt-8 grid gap-8 md:grid-cols-3">
                <div className="md:col-span-1 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
                                <WalletIcon className="h-5 w-5" />
                                Current Balance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">GHS {userProfile?.wallet_balance?.toFixed(2) || '0.00'}</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>Your most recent transactions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-border">
                                {transactions.length > 0 ? transactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center py-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                            {tx.amount >= 0 ? 
                                                <ArrowDownCircle className="h-5 w-5 text-success" /> : 
                                                <ArrowUpCircle className="h-5 w-5 text-destructive" />
                                            }
                                        </div>
                                        <div className="ml-4 flex-grow">
                                            <p className="font-semibold capitalize">{tx.description || tx.transaction_type}</p>
                                            <p className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                                        </div>
                                        <p className={cn(
                                            "font-semibold",
                                            tx.amount >= 0 ? 'text-success' : 'text-destructive'
                                        )}>
                                            {tx.amount >= 0 ? `+${Number(tx.amount).toFixed(2)}` : `${Number(tx.amount).toFixed(2)}`}
                                        </p>
                                    </div>
                                )) : (
                                    <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
