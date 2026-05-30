"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, Wallet, ShoppingCart, Package,
  Edit, Tag, ExternalLink, Copy, ArrowUpRight,
  RefreshCw, LayoutDashboard, ShoppingBag, Eye,
  History, Store, Link as LinkIcon, ChevronLeft,
  ChevronRight, Menu, X,
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

const WITHDRAWALS_PER_PAGE = 5;
const ORDERS_PER_PAGE = 8;

/* ─── Status pill ─────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const map: Record<string, { bg: string; dot: string; text: string }> = {
    completed:  { bg: "bg-emerald-50 dark:bg-emerald-950/40", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
    delivered:  { bg: "bg-emerald-50 dark:bg-emerald-950/40", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
    rejected:   { bg: "bg-red-50 dark:bg-red-950/40",         dot: "bg-red-500",     text: "text-red-700 dark:text-red-300" },
    failed:     { bg: "bg-red-50 dark:bg-red-950/40",         dot: "bg-red-500",     text: "text-red-700 dark:text-red-300" },
    processing: { bg: "bg-blue-50 dark:bg-blue-950/40",       dot: "bg-blue-500",    text: "text-blue-700 dark:text-blue-300" },
    pending:    { bg: "bg-amber-50 dark:bg-amber-950/40",     dot: "bg-amber-400",   text: "text-amber-700 dark:text-amber-300" },
  };
  const cls = map[s] ?? { bg: "bg-muted", dot: "bg-muted-foreground", text: "text-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls.bg} ${cls.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
      {status}
    </span>
  );
}

/* ─── Pagination ──────────────────────────────────────────── */
function Pagination({
  page, total, perPage, onChange,
}: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
      <p className="text-[11px] text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{" "}
        <span className="font-semibold text-foreground">{pages}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="w-7 h-7 rounded-lg flex items-center justify-center border border-border disabled:opacity-30 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          let p = i + 1;
          if (pages > 5) {
            if (page <= 3) p = i + 1;
            else if (page >= pages - 2) p = pages - 4 + i;
            else p = page - 2 + i;
          }
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
          className="w-7 h-7 rounded-lg flex items-center justify-center border border-border disabled:opacity-30 hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Stat card ────────────────────────────────────────────── */
function StatCard({
  label, value, sub, icon: Icon, accent, action,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={`relative rounded-2xl p-5 flex flex-col gap-3 min-h-[140px] border transition-shadow hover:shadow-md
      ${accent
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card border-border"
      }`}
    >
      <div className="flex items-start justify-between">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {label}
        </p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? "bg-primary-foreground/15" : "bg-muted"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`} />
        </div>
      </div>
      <div>
        <p className={`text-3xl font-extrabold leading-none ${accent ? "text-primary-foreground" : "text-foreground"}`}>
          {value}
        </p>
        <p className={`text-[11px] mt-1.5 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {sub}
        </p>
      </div>
      {action && <div className="mt-auto">{action}</div>}
    </div>
  );
}

/* ─── Nav item ─────────────────────────────────────────────── */
function NavItem({
  icon: Icon, label, active, badge, onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
        ${active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
        }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function ResellerDashboard() {
  const { user, userProfile, loading, logout, refreshUser } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  if (!loading && userProfile && !userProfile?.is_reseller) {
    router.push("/profile");
    return null;
  }

  const [stats,              setStats]              = useState<StoreStats>({ totalEarnings: 0, walletBalance: 0, totalPackages: 0, activePackages: 0, totalOrders: 0 });
  const [loadingStats,       setLoadingStats]       = useState(true);
  const [loadingTimeout,     setLoadingTimeout]     = useState(false);
  const [storeOrders,        setStoreOrders]        = useState<any[]>([]);
  const [loadingOrders,      setLoadingOrders]      = useState(false);
  const [withdrawals,        setWithdrawals]        = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [sidebarOpen,        setSidebarOpen]        = useState(false);
  const [withdrawalsPage,    setWithdrawalsPage]    = useState(1);
  const [ordersPage,         setOrdersPage]         = useState(1);

  const paginatedWithdrawals = useMemo(() => {
    const start = (withdrawalsPage - 1) * WITHDRAWALS_PER_PAGE;
    return withdrawals.slice(start, start + WITHDRAWALS_PER_PAGE);
  }, [withdrawals, withdrawalsPage]);

  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ORDERS_PER_PAGE;
    return storeOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [storeOrders, ordersPage]);

  useEffect(() => {
    const timer = setTimeout(() => { if (loading) setLoadingTimeout(true); }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (userProfile?.is_reseller) {
      fetchStats();
      fetchOrders();
      fetchWithdrawals();
    }
  }, [userProfile, pathname]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/reseller/stats", { cache: "no-store" });
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error("Failed to fetch stats:", e); }
    finally { setLoadingStats(false); }
  };

  const fetchOrders = async () => {
    if (!userProfile?.is_reseller) return;
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/reseller/orders?type=store", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStoreOrders(data.orders || []);
      }
    } catch (e) { console.error("Failed to fetch store orders:", e); }
    finally { setLoadingOrders(false); }
  };

  const fetchWithdrawals = async () => {
    if (!userProfile?.is_reseller) return;
    setLoadingWithdrawals(true);
    try {
      const res = await fetch("/api/reseller/withdrawals", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (e) { console.error("Failed to fetch withdrawals:", e); }
    finally { setLoadingWithdrawals(false); }
  };

  const copyStoreUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app";
    const storePath = userProfile?.reseller_slug ? `/store/${userProfile.reseller_slug}` : "";
    navigator.clipboard.writeText(`https://${baseUrl}${storePath}`);
    toast({ title: "Copied!", description: "Store URL copied to clipboard." });
  };

  if ((loading && !loadingTimeout) || !user) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">
            {loadingTimeout ? "Taking longer than expected…" : "Loading your dashboard…"}
          </p>
        </div>
      </div>
    );
  }

  const BASE       = process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app";
  const storeUrl   = userProfile?.reseller_slug ? `https://${BASE}/store/${userProfile.reseller_slug}` : "";
  const isApproved = userProfile?.reseller_approved;
  const fmt        = (n: number) => loadingStats ? "—" : `₵${n.toFixed(2)}`;
  const storeViewUrl = userProfile?.reseller_slug
    ? `https://${process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app"}/store/${userProfile.reseller_slug}`
    : "#";

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true, fn: undefined },
    { icon: ShoppingBag,     label: "Orders",    badge: stats.totalOrders,    fn: () => router.push("/reseller/orders") },
    { icon: Package,         label: "Packages",  badge: stats.activePackages, fn: () => router.push("/reseller/pricing") },
  ];

  const storeItems = [
    { icon: Edit,         label: "Edit Store",  fn: () => router.push("/reseller/edit-store") },
    { icon: Tag,          label: "Edit Prices", fn: () => router.push("/reseller/pricing") },
    { icon: Eye,          label: "View Store",  fn: () => window.open(storeViewUrl, "_blank") },
  ];

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 mb-2">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <Store className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-extrabold leading-none tracking-tight">SBBundles</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Reseller Portal</p>
        </div>
      </div>

      <div className="px-2 space-y-0.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">Main</p>
        {navItems.map((n) => (
          <NavItem key={n.label} icon={n.icon} label={n.label} active={n.active} badge={n.badge} onClick={n.fn} />
        ))}
      </div>

      <div className="px-2 mt-3 space-y-0.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">Store</p>
        {storeItems.map((n) => (
          <NavItem key={n.label} icon={n.icon} label={n.label} onClick={n.fn} />
        ))}
      </div>

      <div className="px-2 mt-3 space-y-0.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">Finance</p>
        <NavItem icon={Wallet}  label="Withdrawals" badge={withdrawals.filter(w => w.status === "pending").length} />
        <NavItem icon={History} label="History" />
      </div>

      {/* Store status */}
      <div className="mt-auto px-2 pb-3">
        <div className="bg-muted/50 rounded-2xl p-3.5 flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${isApproved ? "bg-emerald-500 shadow-emerald-500/30" : "bg-muted-foreground"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{userProfile?.store_name || "Your Store"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isApproved ? "✓ Active & Approved" : "Pending approval"}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">

      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside className="hidden lg:flex w-[240px] flex-shrink-0 bg-card border-r border-border flex-col py-3 gap-0 sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar overlay ────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-card border-r border-border flex flex-col py-3 overflow-y-auto shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">

        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold leading-none">Store Dashboard</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isApproved && (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Store Live
              </span>
            )}
            <button
              onClick={() => { fetchStats(); fetchOrders(); fetchWithdrawals(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5">

          {/* ── Stats grid ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="col-span-2">
              <StatCard
                label="Available Earnings"
                value={fmt(stats.totalEarnings)}
                sub="Ready to withdraw from store profits"
                icon={DollarSign}
                accent
                action={
                  !loadingStats ? (
                    <WithdrawalDialog
                      walletBalance={stats.totalEarnings}
                      onSuccess={async () => { await Promise.all([fetchStats(), fetchWithdrawals()]); }}
                    />
                  ) : null
                }
              />
            </div>
            <StatCard
              label="Lifetime Earnings"
              value={fmt(stats.lifetimeEarnings ?? stats.totalEarnings)}
              sub="All-time store revenue"
              icon={TrendingUp}
            />
            <StatCard
              label="Total Orders"
              value={loadingStats ? "—" : String(stats.totalOrders)}
              sub="Orders processed"
              icon={ShoppingCart}
            />
            <div className="col-span-2">
              <StatCard
                label="Wallet Balance"
                value={fmt(stats.walletBalance)}
                sub="Main site balance · for purchases"
                icon={Wallet}
                action={
                  !loadingStats && stats.totalEarnings > 0 ? (
                    <MoveToWalletDialog availableEarnings={stats.totalEarnings} />
                  ) : null
                }
              />
            </div>
            <StatCard
              label="Active Packages"
              value={loadingStats ? "—" : String(stats.activePackages)}
              sub="Listed in your store"
              icon={Package}
            />
            <StatCard
              label="Total Packages"
              value={loadingStats ? "—" : String(stats.totalPackages)}
              sub="All configured packages"
              icon={ShoppingBag}
            />
          </div>

          {/* ── Quick actions ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Edit,         label: "Edit Store",  sub: "Name, logo & info",   fn: () => router.push("/reseller/edit-store") },
              { icon: Tag,          label: "Edit Prices", sub: "Set your margins",     fn: () => router.push("/reseller/pricing") },
              { icon: ExternalLink, label: "Open Store",  sub: "Customer-facing view", fn: () => window.open(storeViewUrl, "_blank") },
            ].map(({ icon: Icon, label, sub, fn }) => (
              <button
                key={label}
                onClick={fn}
                className="group flex items-center gap-3 bg-card hover:bg-primary border border-border hover:border-primary rounded-2xl px-4 py-3.5 transition-all duration-150 text-left shadow-sm hover:shadow-md"
              >
                <div className="w-9 h-9 bg-muted group-hover:bg-primary-foreground/15 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary-foreground transition-colors leading-none">
                    {label}
                  </p>
                  <p className="text-[10px] text-muted-foreground group-hover:text-primary-foreground/70 mt-1 transition-colors">
                    {sub}
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary-foreground/70 flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>

          {/* ── Store URL bar ── */}
          <div className="bg-card border border-border rounded-2xl flex items-center gap-3 px-4 py-3 shadow-sm">
            <div className="w-7 h-7 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <input
              type="text"
              readOnly
              value={storeUrl || "No store URL — set your slug in Edit Store"}
              className="flex-1 bg-transparent text-[13px] font-bold text-black dark:text-white outline-none min-w-0 tracking-tight"
            />
            <button
              onClick={copyStoreUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 rounded-lg text-primary-foreground text-[11px] font-semibold transition-colors flex-shrink-0"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </div>

          {/* ── Orders & Withdrawals ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Store Orders panel */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-extrabold">Store Orders</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Orders placed through your store
                  </p>
                </div>
                {storeOrders.length > 0 && (
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {storeOrders.length} orders
                  </span>
                )}
              </div>
              <div className="p-4">
                {loadingOrders ? (
                  <div className="space-y-2 py-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted/50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : storeOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mb-3">
                      <ShoppingCart className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">No store orders yet</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Orders from your customers will appear here</p>
                  </div>
                ) : (
                  <>
                    <ResellerOrdersTable
                      orders={paginatedOrders}
                      type="store"
                      onRefresh={fetchOrders}
                      loading={false}
                    />
                    <Pagination
                      page={ordersPage}
                      total={storeOrders.length}
                      perPage={ORDERS_PER_PAGE}
                      onChange={setOrdersPage}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Withdrawals panel */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold">Withdrawals</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Payout request history</p>
                </div>
                {withdrawals.filter(w => w.status === "pending").length > 0 && (
                  <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full">
                    {withdrawals.filter(w => w.status === "pending").length} pending
                  </span>
                )}
              </div>
              <div className="p-4">
                {loadingWithdrawals ? (
                  <div className="space-y-2 py-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : withdrawals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mb-3">
                      <Wallet className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">No withdrawals yet</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Your payout requests will appear here</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {paginatedWithdrawals.map((w) => {
                        const treatedAt = w.completed_at || w.processed_at || null;
                        return (
                          <div
                            key={w.id}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                          >
                            <div className="w-9 h-9 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                              <DollarSign className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-foreground truncate">
                                {w.momo_name || "—"}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {w.momo_number || "—"} · {format(new Date(w.created_at), "MMM d, h:mm a")}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <p className="text-sm font-extrabold">₵{Number(w.amount || 0).toFixed(2)}</p>
                              <StatusPill status={w.status} />
                            </div>
                            {treatedAt && (
                              <div className="text-[10px] text-muted-foreground text-right flex-shrink-0 min-w-[40px] hidden sm:block">
                                <div className="font-semibold">{format(new Date(treatedAt), "MMM d")}</div>
                                <div className="text-muted-foreground/50">{format(new Date(treatedAt), "h:mm a")}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Pagination
                      page={withdrawalsPage}
                      total={withdrawals.length}
                      perPage={WITHDRAWALS_PER_PAGE}
                      onChange={setWithdrawalsPage}
                    />
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}