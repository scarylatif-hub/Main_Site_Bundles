"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, Wallet, ShoppingCart, Package,
  Edit, Tag, ExternalLink, Copy, ArrowUpRight,
  RefreshCw, LayoutDashboard, ShoppingBag, Eye,
  History, Store, Link as LinkIcon,
} from "lucide-react";
import { WithdrawalDialog } from "@/components/reseller/withdrawal-dialog";
import { MoveToWalletDialog } from "@/components/reseller/move-to-wallet-dialog";
import { ResellerOrdersTable } from "@/components/reseller/reseller-orders-table";
import { Profile } from "@/lib/definitions";

/* ─── Types ───────────────────────────────────────────────── */
type StoreStats = {
  totalEarnings: number;
  lifetimeEarnings?: number;
  walletBalance: number;
  totalPackages: number;
  activePackages: number;
  totalOrders: number;
};

type WithdrawalRequest = {
  id: string;
  amount: number;
  status: string;
  momo_number: string | null;
  momo_name: string | null;
  reference: string | null;
  created_at: string;
  processed_at?: string | null;
  completed_at?: string | null;
};

/* ─── Sidebar nav item ─────────────────────────────────────── */
function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
        ${active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground"}`}
      />
      {label}
    </button>
  );
}

/* ─── Stat card ────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  yellow,
  wide,
  action,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  yellow?: boolean;
  wide?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-2xl p-5 flex flex-col justify-between min-h-[130px]
        ${wide ? "col-span-2" : ""}
        ${yellow
          ? "bg-primary text-primary-foreground border border-primary"
          : "bg-card border border-border"
        }`}
    >
      <div
        className={`absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center
          ${yellow ? "bg-primary-foreground/15" : "bg-muted"}`}
      >
        <Icon className={`w-3.5 h-3.5 ${yellow ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
      </div>
      <div>
        <p
          className={`text-[10px] font-semibold uppercase tracking-widest mb-2
            ${yellow ? "text-primary-foreground/80" : "text-muted-foreground"}`}
        >
          {label}
        </p>
        <p
          className={`font-extrabold leading-none
            ${wide && yellow ? "text-4xl" : "text-2xl"}
            ${yellow ? "text-primary-foreground" : "text-foreground"}`}
        >
          {value}
        </p>
        <p className={`text-[10px] mt-1.5 ${yellow ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          {sub}
        </p>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Status pill ─────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const map: Record<string, string> = {
    completed:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    delivered:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    rejected:   "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    failed:     "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    pending:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  };
  const cls = map[s] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function ResellerDashboard() {
  const { user, userProfile, loading, logout, refreshUser } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  // Early redirect for non-resellers — BEFORE any other hooks (mirrors original)
  if (!loading && userProfile && !userProfile?.is_reseller) {
    router.push("/profile");
    return null;
  }

  const [stats, setStats] = useState<StoreStats>({
    totalEarnings: 0,
    walletBalance: 0,
    totalPackages: 0,
    activePackages: 0,
    totalOrders: 0,
  });
  const [loadingStats,       setLoadingStats]       = useState(true);
  const [loadingTimeout,     setLoadingTimeout]     = useState(false);
  const [localProfile,       setLocalProfile]       = useState<Profile | null>(null);
  const [ordersTab,          setOrdersTab]          = useState<"personal" | "store">("personal");
  const [personalOrders,     setPersonalOrders]     = useState<any[]>([]);
  const [storeOrders,        setStoreOrders]        = useState<any[]>([]);
  const [loadingOrders,      setLoadingOrders]      = useState(false);
  const [withdrawals,        setWithdrawals]        = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);

  // 5-second loading timeout (from original)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setLoadingTimeout(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Redirect unauthenticated users (from original)
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Fetch all data when reseller profile is confirmed (from original)
  useEffect(() => {
    if (userProfile?.is_reseller) {
      fetchStats();
      fetchOrders("personal"); // Load personal orders initially
      fetchWithdrawals();
    }
  }, [userProfile, pathname]);

  // Lazy-load store orders only when that tab is first opened (from original)
  useEffect(() => {
    if (ordersTab === "store" && storeOrders.length === 0) {
      fetchOrders("store");
    }
  }, [ordersTab]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/reseller/stats", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchOrders = async (type: "personal" | "store") => {
    if (!userProfile?.is_reseller) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/reseller/orders?type=${type}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (type === "personal") {
          setPersonalOrders(data.orders || []);
        } else {
          setStoreOrders(data.orders || []);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${type} orders:`, error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchWithdrawals = async () => {
    if (!userProfile?.is_reseller) return;
    setLoadingWithdrawals(true);
    try {
      const res = await fetch("/api/reseller/withdrawals", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const copyStoreUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app";
    const storePath = userProfile?.reseller_slug
      ? `/store/${userProfile.reseller_slug}`
      : "";
    const fullUrl = `https://${baseUrl}${storePath}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: "Copied to clipboard",
      description: "Store URL has been copied to your clipboard.",
    });
  };

  // Loading / unauthenticated gate (from original)
  if ((loading && !loadingTimeout) || !user) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="text-muted-foreground text-sm">
          {loadingTimeout ? "Taking longer than expected..." : "Loading..."}
        </div>
      </div>
    );
  }

  const BASE     = process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app";
  const storeUrl = userProfile?.reseller_slug
    ? `https://${BASE}/store/${userProfile.reseller_slug}`
    : "";
  const isApproved = userProfile?.reseller_approved;
  const fmt = (n: number) => loadingStats ? "—" : `₵${n.toFixed(2)}`;

  return (
    <div
      className="flex min-h-screen bg-background text-foreground overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-[220px] flex-shrink-0 bg-card border-r border-border flex-col px-3 py-5 gap-1">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-5">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none">SBBundles</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Reseller portal</p>
          </div>
        </div>

        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1">Main</p>
        <NavItem icon={LayoutDashboard} label="Dashboard" active />
        <NavItem icon={ShoppingBag}     label="Orders"    onClick={() => router.push("/reseller/orders")} />
        <NavItem icon={Package}         label="Packages"  onClick={() => router.push("/reseller/packages")} />

        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1 pt-3">Store</p>
        <NavItem icon={Edit} label="Edit Store"  onClick={() => router.push("/reseller/edit-store")} />
        <NavItem icon={Tag}  label="Edit Prices" onClick={() => router.push("/reseller/pricing")} />
        <NavItem icon={Eye}  label="View Store"  onClick={() => {
          const url = userProfile?.reseller_slug
            ? `https://${process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app"}/store/${userProfile.reseller_slug}`
            : "#";
          window.open(url, "_blank");
        }} />

        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1 pt-3">Finance</p>
        <NavItem icon={Wallet}  label="Withdrawals" />
        <NavItem icon={History} label="History" />

        {/* Store status badge */}
        <div className="mt-auto mx-1 bg-muted/40 rounded-xl p-3 flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isApproved ? "bg-emerald-500" : "bg-muted-foreground"
            }`}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              {userProfile?.store_name || "Your Store"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isApproved ? "Active · Approved" : "Pending approval"}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

          {/* Top bar */}
          <div className="flex items-start justify-between mb-4 sm:mb-6 gap-2">
            <div>
              <h1 className="text-base sm:text-lg font-bold">Store Dashboard</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
            <button
              onClick={() => {
                fetchStats();
                fetchOrders(ordersTab);
                fetchWithdrawals();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* ── Bento stats grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">

            {/* Available earnings — hero yellow 2-wide */}
            <StatCard
              label="Available earnings"
              value={fmt(stats.totalEarnings)}
              sub="Ready for withdrawal from store profits"
              icon={DollarSign}
              yellow
              wide
              action={
                !loadingStats ? (
                  <WithdrawalDialog
                    walletBalance={stats.totalEarnings}
                    onSuccess={async () => {
                      await Promise.all([fetchStats(), fetchWithdrawals()]);
                    }}
                  />
                ) : null
              }
            />

            <StatCard
              label="Lifetime earnings"
              value={fmt(stats.lifetimeEarnings ?? stats.totalEarnings)}
              sub="All-time store revenue"
              icon={TrendingUp}
            />

            <StatCard
              label="Total orders"
              value={loadingStats ? "—" : String(stats.totalOrders)}
              sub="Orders processed"
              icon={ShoppingCart}
            />

            {/* Wallet balance — 2-wide with MoveToWallet action */}
            <StatCard
              label="Wallet balance"
              value={fmt(stats.walletBalance)}
              sub="Main site balance · for purchases"
              icon={Wallet}
              wide
              action={
                !loadingStats && stats.totalEarnings > 0 ? (
                  <MoveToWalletDialog availableEarnings={stats.totalEarnings} />
                ) : null
              }
            />

            <StatCard
              label="Active packages"
              value={loadingStats ? "—" : String(stats.activePackages)}
              sub="Listed in your store"
              icon={Package}
            />
          </div>

          {/* ── Quick actions ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-3">
            {[
              {
                icon: Edit,
                label: "Edit Store",
                sub: "Name, logo, info",
                fn: () => router.push("/reseller/edit-store"),
              },
              {
                icon: Tag,
                label: "Edit Prices",
                sub: "Set your margins",
                fn: () => router.push("/reseller/pricing"),
              },
              {
                icon: ExternalLink,
                label: "Open Store",
                sub: "Customer view",
                fn: () => {
                  const url = userProfile?.reseller_slug
                    ? `https://${process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app"}/store/${userProfile.reseller_slug}`
                    : "#";
                  window.open(url, "_blank");
                },
              },
            ].map(({ icon: Icon, label, sub, fn }) => (
              <button
                key={label}
                onClick={fn}
                className="group flex items-center gap-3 bg-card hover:bg-primary border border-border hover:border-primary rounded-2xl px-4 py-3.5 transition-all duration-150 text-left"
              >
                <div className="w-8 h-8 bg-muted group-hover:bg-primary-foreground/15 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary-foreground transition-colors leading-none">
                    {label}
                  </p>
                  <p className="text-[10px] text-muted-foreground group-hover:text-primary-foreground/80 mt-0.5 transition-colors">
                    {sub}
                  </p>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary-foreground/70 ml-auto flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>

          {/* ── Store URL ── */}
          <div className="bg-card border border-border rounded-2xl mb-3 flex items-center gap-3 px-3 sm:px-4 py-3">
            <LinkIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              readOnly
              value={storeUrl}
              className="flex-1 bg-transparent text-[11px] font-mono text-muted-foreground outline-none min-w-0"
            />
            <button
              onClick={copyStoreUrl}
              className="w-8 h-8 bg-primary hover:bg-primary/90 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-primary-foreground" />
            </button>
          </div>

          {/* ── Bottom two-column panels ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">

            {/* Orders panel */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-bold">Orders</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Personal &amp; store purchases
                  </p>
                </div>
                <div className="flex gap-1 bg-muted rounded-lg p-1 w-full sm:w-auto">
                  {(["personal", "store"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setOrdersTab(t)}
                      className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[10px] font-bold transition-all
                        ${ordersTab === t
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {t === "personal"
                        ? `Mine (${personalOrders.length})`
                        : `Store (${storeOrders.length})`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <ResellerOrdersTable
                  orders={ordersTab === "personal" ? personalOrders : storeOrders}
                  type={ordersTab}
                  onRefresh={() => fetchOrders(ordersTab)}
                  loading={loadingOrders && ordersTab === ordersTab}
                />
              </div>
            </div>

            {/* Withdrawals panel */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-border">
                <p className="text-sm font-bold">Withdrawals</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Payout request history
                </p>
              </div>
              <div className="p-3 sm:p-4">
                {loadingWithdrawals ? (
                  <p className="text-muted-foreground text-xs py-6 text-center">
                    Loading withdrawal requests...
                  </p>
                ) : withdrawals.length === 0 ? (
                  <p className="text-muted-foreground text-xs py-8 text-center">
                    No withdrawal requests yet.
                  </p>
                ) : (
                  <div>
                    {withdrawals.map((w) => {
                      const treatedAt = w.completed_at || w.processed_at || null;
                      return (
                        <div
                          key={w.id}
                          className="flex items-center gap-2 sm:gap-3 py-3 border-b border-border last:border-none"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {w.momo_name || "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {w.momo_number || "—"} · {format(new Date(w.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-foreground flex-shrink-0">
                            ₵{Number(w.amount || 0).toFixed(2)}
                          </p>
                          <StatusPill status={w.status} />
                          <div className="text-[10px] text-muted-foreground text-right flex-shrink-0 min-w-[44px]">
                            {treatedAt ? (
                              <>
                                <div>{format(new Date(treatedAt), "MMM d")}</div>
                                <div className="text-muted-foreground/60">
                                  {format(new Date(treatedAt), "h:mm a")}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground/50">Waiting</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}