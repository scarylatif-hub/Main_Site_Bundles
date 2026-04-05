
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Transaction } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { WalletDepositCard } from '@/components/wallet-deposit-card';
import {
  TablePaginationBar,
  PAGE_SIZE,
} from '@/components/ui/table-pagination-bar';

export default function WalletPage() {
    const { user, loading, userProfile } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [txPageIndex, setTxPageIndex] = useState(0);
    const { toast } = useToast();

    const fetchTransactions = useCallback(async () => {
        if (!user) {
            setIsFetching(false);
            return;
        };
        setIsFetching(true);
        
        const { data: transactionsData, error: transactionsError } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(200);
        
        if (transactionsError) {
            console.error('Error fetching transactions:', transactionsError.message || transactionsError);
            toast({ title: 'Error', description: 'Could not fetch transaction history.', variant: 'destructive'});
        } else {
            setTransactions(transactionsData || []);
            setTxPageIndex(0);
        }
        setIsFetching(false);
    }, [user, toast]);
    
    useEffect(() => {
        if (!loading) {
            fetchTransactions();
        }
    }, [loading, fetchTransactions]);

    const txPageCount = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
    const pagedTransactions = useMemo(() => {
        const start = txPageIndex * PAGE_SIZE;
        return transactions.slice(start, start + PAGE_SIZE);
    }, [transactions, txPageIndex]);

    useEffect(() => {
        setTxPageIndex((i) => Math.min(i, Math.max(0, txPageCount - 1)));
    }, [txPageCount, transactions.length]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
            </div>
        );
    }

    if (!user) {
         return (
            <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12 text-center">
                <PageHeader
                    title="My Wallet"
                    description="Please log in to view your wallet."
                />
                 <Button asChild className="mt-4">
                        <Link href="/login">Login</Link>
                </Button>
            </div>
        );
    }

    return (

        
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
            <PageHeader
                title="My Wallet"
                description="Manage your balance and view your transaction history."
            />

            <div className="mt-8 space-y-8">
                <WalletDepositCard id="deposit" />
            </div>

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
                     <Button asChild className="w-full" variant="outline">
                        <Link href="/">Buy data bundles</Link>
                    </Button>
                </div>
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>Your most recent transactions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-border">
                                {isFetching ? (
                                    <p className="text-center text-muted-foreground py-8">Fetching transactions...</p>
                                ) : transactions.length > 0 ? pagedTransactions.map((tx) => {
                                    const isCredit = tx.transaction_type.toLowerCase() === 'deposit';
                                    return (
                                    <div key={tx.id} className="flex items-center py-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                            {isCredit ? 
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
                                            isCredit ? 'text-success' : 'text-destructive'
                                        )}>
                                            {isCredit ? `+${Math.abs(Number(tx.amount)).toFixed(2)}` : `${Math.abs(Number(tx.amount)).toFixed(2)}`}
                                        </p>
                                    </div>
                                )}) : (
                                    <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
                                )}
                            </div>
                            {!isFetching && transactions.length > 0 ? (
                                <TablePaginationBar
                                    pageIndex={txPageIndex}
                                    pageCount={txPageCount}
                                    totalRows={transactions.length}
                                    onPageChange={setTxPageIndex}
                                    className="px-6 pb-2 pt-0"
                                />
                            ) : null}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
