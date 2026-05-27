"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import type { Profile } from "@/lib/definitions";
import { useMaintenanceMode } from "@/hooks/use-maintenance-mode";

// ── Types ─────────────────────────────────────────────────────────────────────

type Package = {
  id: number;
  network_id: number;
  name: string;
  data_amount: string;
  cost_price: number;
  selling_price: number;
  validity?: string;
  volume?: string;
};

type CustomerOrder = {
  id: string;
  package_id: number;
  network_id: number;
  phone_number: string;
  amount: number;
  status: string;
  created_at: string;
  package_name?: string;
  data_amount?: string;
};

interface StoreClientProps {
  storeOwner: Profile;
  packages: Package[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NETWORK_PREFIXES: Record<string, string[]> = {
  MTN:       ["024", "025", "053", "054", "055", "059"],
  TELECEL:   ["020", "050"],
  AIRTELTIGO:["026", "027", "056", "057"],
};

const NETWORK_MAP: Record<number, { label: string; color: string; bg: string; dot: string }> = {
  1: { label: "MTN",        color: "#FFCC00", bg: "#fffbeb", dot: "#d97706" },
  2: { label: "Telecel",    color: "#CC0000", bg: "#fff1f1", dot: "#CC0000" },
  3: { label: "AirtelTigo", color: "#E8001C", bg: "#fff1f2", dot: "#E8001C" },
  4: { label: "AirtelTigo", color: "#E8001C", bg: "#fff1f2", dot: "#E8001C" },
  5: { label: "MTN AFA",    color: "#FFCC00", bg: "#fffbeb", dot: "#d97706" },
};

const ALLOWED_NETWORKS = [1, 2, 3];

// ── Cookie helpers ────────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days: number) {
  const e = new Date();
  e.setTime(e.getTime() + days * 864e5);
  document.cookie = `${name}=${value};expires=${e.toUTCString()};path=/`;
}
function getCookie(name: string): string | null {
  const eq = `${name}=`;
  for (let c of document.cookie.split(";")) {
    c = c.trim();
    if (c.startsWith(eq)) return c.slice(eq.length);
  }
  return null;
}

// ── Network detection ─────────────────────────────────────────────────────────

function detectNetwork(phone: string): string | null {
  const p = phone.replace(/\s/g, "").slice(0, 3);
  for (const [net, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(p)) return net;
  }
  return null;
}

function formatPhone(raw: string): string {
  let v = raw.replace(/\s/g, "").replace(/[^\d+]/g, "");
  if (v.startsWith("+233")) v = "0" + v.slice(4);
  v = v.replace(/\+/g, "");
  if (v.length > 0 && !v.startsWith("0")) v = "0" + v;
  return v.slice(0, 10);
}

const PENDING_STORE_PAYMENT_KEY = "pending_store_payment";

type PendingStorePayment = {
  reference: string;
  store_id: string;
  package_id: number;
  network_id: number;
  phone_number: string;
  email: string;
  amount: number;
  data_amount: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StoreClient({ storeOwner, packages }: StoreClientProps) {
  const [phone, setPhone]               = useState("");
  const [name, setName]                 = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<number | null>(null);
  const [selectedPkg, setSelectedPkg]   = useState<Package | null>(null);
  const [detectedNet, setDetectedNet]   = useState<string | null>(null);
  const [purchasing, setPurchasing]     = useState(false);
  const [tab, setTab]                   = useState<"buy" | "orders">("buy");
  const [orders, setOrders]             = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [step, setStep]                 = useState<"phone" | "packages">("phone");
  const completingReturnRef = useRef(false);
  const { isMaintenance } = useMaintenanceMode();

  // Theme from store owner
  const themeColor = (storeOwner as any).store_theme_color || "#6366f1";
  const logoUrl    = (storeOwner as any).store_logo_url || null;
  const storeName  = (storeOwner as any).store_name || storeOwner.full_name || "Data Store";
  const storeDesc  = (storeOwner as any).store_description || "Fast data bundles, delivered instantly.";

  useEffect(() => {
    const savedPhone = getCookie("store_phone");
    const savedName  = getCookie("store_nickname");
    if (savedPhone) { setPhone(savedPhone); handlePhoneDetect(savedPhone); setStep("packages"); }
    if (savedName)  setName(savedName);
  }, []);

  useEffect(() => {
    if (completingReturnRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return;

    const pendingRaw = sessionStorage.getItem(PENDING_STORE_PAYMENT_KEY);
    if (!pendingRaw) {
      toast({
        title: "Payment received",
        description: "We could not find the pending order on this browser. Contact support with your Paystack reference.",
        variant: "destructive",
      });
      return;
    }

    let pending: PendingStorePayment;
    try {
      pending = JSON.parse(pendingRaw) as PendingStorePayment;
    } catch {
      sessionStorage.removeItem(PENDING_STORE_PAYMENT_KEY);
      return;
    }

    if (pending.reference !== reference) return;

    completingReturnRef.current = true;
    setPurchasing(true);
    fetch("/api/guest/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_id:          pending.store_id,
        package_id:        pending.package_id,
        network_id:        pending.network_id,
        phone_number:      pending.phone_number,
        email:             pending.email,
        amount:            pending.amount,
        payment_reference: pending.reference,
      }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || data.error) throw new Error(data.error || "Could not complete order");
        sessionStorage.removeItem(PENDING_STORE_PAYMENT_KEY);
        toast({
          title: "Data Sent!",
          description: `${pending.data_amount} is on its way to ${pending.phone_number}.`,
        });
        setPhone(pending.phone_number);
        loadOrders(pending.phone_number);
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch((err) => {
        toast({
          title: "Purchase failed",
          description: err instanceof Error ? err.message : "Could not complete order",
          variant: "destructive",
        });
      })
      .finally(() => {
        setPurchasing(false);
      });
  }, []);

  function handlePhoneDetect(val: string) {
    const net = detectNetwork(val);
    setDetectedNet(net);
    if (net === "MTN")        setSelectedNetwork(1);  // Display ID 1 = MTN
    else if (net === "TELECEL")    setSelectedNetwork(2);  // Display ID 2 = Telecel
    else if (net === "AIRTELTIGO") setSelectedNetwork(3);  // Display ID 3 = AirtelTigo
  }

  function handlePhoneChange(val: string) {
    const formatted = formatPhone(val);
    setPhone(formatted);
    handlePhoneDetect(formatted);
  }

  function handlePhoneContinue() {
    if (phone.length < 10) {
      toast({ title: "Invalid number", description: "Enter a valid 10-digit Ghana phone number.", variant: "destructive" });
      return;
    }
    setCookie("store_phone", phone, 30);
    if (name) setCookie("store_nickname", name, 30);
    setStep("packages");
  }

  const networks = useMemo(() =>
    [...new Set(packages.map(p => p.network_id))].filter(n => ALLOWED_NETWORKS.includes(n)),
    [packages]
  );

  const visiblePackages = useMemo(() =>
    packages.filter(p =>
      ALLOWED_NETWORKS.includes(p.network_id) &&
      (selectedNetwork === null || p.network_id === selectedNetwork)
    ),
    [packages, selectedNetwork]
  );

  async function loadOrders(p: string) {
    if (!p) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/store/${storeOwner.reseller_slug}/orders?phone=${p}`);
      const data = await res.json();
      if (data.success) setOrders(data.orders || []);
    } catch { /* silent */ }
    finally { setLoadingOrders(false); }
  }

  async function handlePurchase() {
    if (!selectedPkg || !phone) return;
    if (purchasing) return;
    setShowConfirm(false);
    setPurchasing(true);

    const email = name?.includes("@") ? name : `${phone}@gmail.com`;

    try {
      const init = await fetch("/api/paystack/guest/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedPkg.selling_price,
          email,
          callbackUrl: `${window.location.origin}/store/${storeOwner.reseller_slug}`,
          metadata: {
            store_id:     storeOwner.id,
            package_id:   selectedPkg.id,
            network_id:   selectedPkg.network_id,
            phone_number: phone,
            customer_name: name,
          },
        }),
      });

      const initData = await init.json();
      if (!init.ok || !initData.authorizationUrl || !initData.reference) {
        throw new Error(initData.error || "Failed to initialize payment");
      }

      const reference = initData.reference;

      const pending: PendingStorePayment = {
        reference,
        store_id: storeOwner.id,
        package_id: selectedPkg.id,
        network_id: selectedPkg.network_id,
        phone_number: phone,
        email,
        amount: selectedPkg.selling_price,
        data_amount: selectedPkg.data_amount || selectedPkg.name,
      };
      sessionStorage.setItem(PENDING_STORE_PAYMENT_KEY, JSON.stringify(pending));
      window.location.href = initData.authorizationUrl;
      return;
    } catch (err) {
      toast({ title: "Payment failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setPurchasing(false);
    }
  }

  const netInfo = (id: number) => NETWORK_MAP[id] ?? { label: `Net ${id}`, color: "#6366f1", bg: "#f0f0ff", dot: "#6366f1" };
  const statusColor = (s: string) =>
    s === "completed" ? "#16a34a" : s === "processing" ? "#d97706" : "#dc2626";

  return (
    <>
      {/* ── CSS variables & global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800&family=Lora:ital@0;1&display=swap');

        :root {
          --brand: ${themeColor};
          --brand-faint: ${themeColor}18;
          --brand-light: ${themeColor}30;
        }

        .store-root {
          font-family: 'Cabinet Grotesk', sans-serif;
          min-height: 100vh;
          background: #f8f7f5;
          color: #1a1a1a;
        }

        /* Header */
        .store-header {
          background: #fff;
          border-bottom: 1px solid #ebebeb;
          padding: 0 1.5rem;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .store-header-inner {
          max-width: 900px;
          margin: 0 auto;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .store-logo-wrap {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .store-logo-img {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          object-fit: cover;
          border: 2px solid var(--brand-light);
        }
        .store-logo-initials {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--brand-faint);
          border: 2px solid var(--brand-light);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1rem;
          color: var(--brand);
        }
        .store-name-block h1 {
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.2;
          margin: 0;
        }
        .store-name-block p {
          font-size: 0.72rem;
          color: #888;
          margin: 0;
          font-style: italic;
          font-family: 'Lora', serif;
        }

        /* Tab nav */
        .store-tabs {
          display: flex;
          gap: 0.25rem;
          background: #f3f2f0;
          border-radius: 10px;
          padding: 3px;
        }
        .store-tab {
          padding: 0.35rem 0.9rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          font-size: 0.8rem;
          transition: all 0.18s ease;
          background: transparent;
          color: #888;
        }
        .store-tab.active {
          background: #fff;
          color: #1a1a1a;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }

        /* Main layout */
        .store-main {
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1.5rem 4rem;
        }

        /* ── Step: Phone entry ── */
        .phone-card {
          background: #fff;
          border-radius: 20px;
          padding: 2.5rem;
          max-width: 440px;
          margin: 2rem auto 0;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }
        .phone-card h2 {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0 0 0.35rem;
        }
        .phone-card .sub {
          color: #888;
          font-size: 0.875rem;
          font-family: 'Lora', serif;
          font-style: italic;
          margin: 0 0 2rem;
        }
        .field-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #555;
          margin-bottom: 0.5rem;
        }
        .field-input {
          width: 100%;
          border: 1.5px solid #e5e5e5;
          border-radius: 12px;
          padding: 0.75rem 1rem;
          font-family: inherit;
          font-size: 1rem;
          font-weight: 500;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
          background: #fafafa;
        }
        .field-input:focus {
          border-color: var(--brand);
          background: #fff;
        }
        .net-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 0.3rem 0.7rem;
          border-radius: 999px;
          margin-top: 0.5rem;
        }
        .net-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .field-hint {
          font-size: 0.75rem;
          color: #aaa;
          margin-top: 0.4rem;
        }
        .field-group {
          margin-bottom: 1.25rem;
        }
        .btn-primary {
          width: 100%;
          padding: 0.85rem;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-weight: 800;
          font-size: 1rem;
          background: var(--brand);
          color: #fff;
          transition: opacity 0.15s, transform 0.1s;
          margin-top: 0.5rem;
        }
        .btn-primary:hover { opacity: 0.88; }
        .btn-primary:active { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Package browser ── */
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .section-title {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0;
        }
        .back-btn {
          background: none;
          border: 1.5px solid #e5e5e5;
          border-radius: 8px;
          padding: 0.3rem 0.75rem;
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          color: #555;
          transition: border-color 0.15s;
        }
        .back-btn:hover { border-color: #aaa; }

        /* Phone indicator */
        .phone-pill {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: #fff;
          border: 1.5px solid #ebebeb;
          border-radius: 14px;
          padding: 0.6rem 1rem;
          margin-bottom: 1.5rem;
        }
        .phone-pill-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--brand-faint);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
        }
        .phone-pill-info { flex: 1; }
        .phone-pill-info strong {
          font-size: 0.95rem;
          font-weight: 700;
          display: block;
          line-height: 1.2;
        }
        .phone-pill-info span {
          font-size: 0.75rem;
          color: #888;
        }
        .phone-pill-change {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--brand);
          cursor: pointer;
          text-decoration: underline;
          background: none;
          border: none;
          font-family: inherit;
        }

        /* Network filter chips */
        .net-chips {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }
        .net-chip {
          padding: 0.4rem 1rem;
          border-radius: 999px;
          border: 1.5px solid #e5e5e5;
          background: #fff;
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          color: #555;
        }
        .net-chip:hover { border-color: #bbb; }
        .net-chip.active {
          border-color: var(--brand);
          background: var(--brand-faint);
          color: var(--brand);
        }

        /* Package grid */
        .pkg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.875rem;
        }
        .pkg-card {
          background: #fff;
          border-radius: 16px;
          border: 2px solid #ebebeb;
          padding: 1.25rem 1rem 1rem;
          cursor: pointer;
          transition: all 0.18s ease;
          position: relative;
          overflow: hidden;
        }
        .pkg-card:hover {
          border-color: var(--brand);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.07);
        }
        .pkg-card.selected {
          border-color: var(--brand);
          background: var(--brand-faint);
        }
        .pkg-card.selected::after {
          content: '✓';
          position: absolute;
          top: 0.6rem;
          right: 0.75rem;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--brand);
          color: #fff;
          font-size: 0.7rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pkg-net-badge {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.6rem;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .pkg-size {
          font-size: 1.75rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 0.15rem;
        }
        .pkg-validity {
          font-size: 0.72rem;
          color: #999;
          margin-bottom: 0.75rem;
          font-family: 'Lora', serif;
          font-style: italic;
        }
        .pkg-price {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--brand);
        }

        /* Checkout bar */
        .checkout-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #fff;
          border-top: 1px solid #ebebeb;
          padding: 1rem 1.5rem;
          z-index: 40;
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .checkout-inner {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .checkout-info strong {
          display: block;
          font-size: 1rem;
          font-weight: 800;
        }
        .checkout-info span {
          font-size: 0.8rem;
          color: #888;
        }
        .checkout-price {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--brand);
        }
        .btn-buy {
          padding: 0.75rem 1.75rem;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-weight: 800;
          font-size: 0.95rem;
          background: var(--brand);
          color: #fff;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .btn-buy:hover { opacity: 0.88; }
        .btn-buy:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Confirm modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0 0 env(safe-area-inset-bottom, 0);
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-sheet {
          background: #fff;
          border-radius: 24px 24px 0 0;
          padding: 1.5rem 1.5rem 2rem;
          width: 100%;
          max-width: 500px;
          animation: sheetUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes sheetUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        .modal-handle {
          width: 36px;
          height: 4px;
          background: #e5e5e5;
          border-radius: 2px;
          margin: 0 auto 1.5rem;
        }
        .modal-title {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0 0 1.25rem;
        }
        .confirm-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.65rem 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 0.9rem;
        }
        .confirm-row:last-of-type { border-bottom: none; }
        .confirm-row .label { color: #888; }
        .confirm-row .value { font-weight: 700; }
        .confirm-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0 0.5rem;
          font-size: 1.1rem;
        }
        .confirm-total .t-label { font-weight: 800; }
        .confirm-total .t-price { font-size: 1.5rem; font-weight: 800; color: var(--brand); }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .btn-cancel {
          flex: 1;
          padding: 0.8rem;
          border-radius: 12px;
          border: 1.5px solid #e5e5e5;
          background: #fff;
          font-family: inherit;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          color: #555;
        }
        .btn-confirm {
          flex: 2;
          padding: 0.8rem;
          border-radius: 12px;
          border: none;
          background: var(--brand);
          color: #fff;
          font-family: inherit;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Orders list */
        .orders-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .order-card {
          background: #fff;
          border-radius: 14px;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          border: 1.5px solid #ebebeb;
        }
        .order-left strong { display: block; font-size: 0.95rem; font-weight: 700; }
        .order-left span { font-size: 0.78rem; color: #888; }
        .order-right { text-align: right; }
        .order-right strong { display: block; font-size: 0.95rem; font-weight: 800; }
        .order-status {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 4rem 1rem;
          color: #bbb;
        }
        .empty-state .icon { font-size: 3rem; margin-bottom: 0.75rem; }
        .empty-state p { font-size: 0.9rem; }

        /* Spinner */
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 600px) {
          .store-main { padding: 1.25rem 1rem 5rem; }
          .phone-card { padding: 1.75rem 1.25rem; }
          .pkg-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="store-root">

        {/* ── Header ── */}
        <header className="store-header">
          <div className="store-header-inner">
            <div className="store-logo-wrap">
              {logoUrl
                ? <img src={logoUrl} alt={storeName} className="store-logo-img" />
                : (
                  <div className="store-logo-initials">
                    {storeName.slice(0, 2).toUpperCase()}
                  </div>
                )
              }
              <div className="store-name-block">
                <h1>{storeName}</h1>
                <p>{storeDesc}</p>
              </div>
            </div>

            <div className="store-tabs">
              <button
                className={`store-tab ${tab === "buy" ? "active" : ""}`}
                onClick={() => setTab("buy")}
              >Buy Data</button>
              <button
                className={`store-tab ${tab === "orders" ? "active" : ""}`}
                onClick={() => { setTab("orders"); loadOrders(phone); }}
              >My Orders</button>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="store-main">

          {/* ── BUY TAB ── */}
          {tab === "buy" && (
            <>
              {/* Step 1: Enter phone */}
              {step === "phone" && (
                <div className="phone-card">
                  <h2>Who are you buying for?</h2>
                  <p className="sub">Enter the phone number to receive the data bundle.</p>

                  <div className="field-group">
                    <label className="field-label" htmlFor="phone">Phone Number *</label>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      className="field-input"
                      placeholder="05XXXXXXXX"
                      value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      autoComplete="tel"
                      disabled={isMaintenance}
                    />
                    {detectedNet && (
                      <div
                        className="net-badge"
                        style={{
                          background: NETWORK_PREFIXES[detectedNet] ? "#f0fdf4" : "#f5f5f5",
                          color: "#16a34a",
                        }}
                      >
                        <span className="net-dot" style={{ background: "#16a34a" }} />
                        {detectedNet} detected
                      </div>
                    )}
                    <p className="field-hint">Ghana number e.g. 0244000000 or +233244000000</p>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="cname">Your Name (Optional)</label>
                    <input
                      id="cname"
                      type="text"
                      className="field-input"
                      placeholder="e.g. Kwame"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      disabled={isMaintenance}
                    />
                    <p className="field-hint">Helps you track your orders later</p>
                  </div>

                  <button className="btn-primary" onClick={handlePhoneContinue} disabled={isMaintenance}>
                    {isMaintenance ? "Maintenance Mode" : "Browse Packages →"}
                  </button>
                  {isMaintenance && (
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-2 text-center">
                      Purchases are currently disabled due to maintenance.
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Choose package */}
              {step === "packages" && (
                <>
                  {/* Phone indicator */}
                  <div className="phone-pill">
                    <div className="phone-pill-icon">📱</div>
                    <div className="phone-pill-info">
                      <strong>{phone}</strong>
                      <span>
                        {detectedNet || "Ghana number"}
                        {name ? ` · ${name}` : ""}
                      </span>
                    </div>
                    <button
                      className="phone-pill-change"
                      onClick={() => { setStep("phone"); setSelectedPkg(null); }}
                    >Change</button>
                  </div>

                  {/* Network filter */}
                  <div className="net-chips">
                    <button
                      className={`net-chip ${selectedNetwork === null ? "active" : ""}`}
                      onClick={() => setSelectedNetwork(null)}
                    >All</button>
                    {networks.map(nid => (
                      <button
                        key={nid}
                        className={`net-chip ${selectedNetwork === nid ? "active" : ""}`}
                        onClick={() => setSelectedNetwork(nid)}
                      >{netInfo(nid).label}</button>
                    ))}
                  </div>

                  {/* Package grid */}
                  <div className="pkg-grid">
                    {visiblePackages.map(pkg => {
                      const ni = netInfo(pkg.network_id);
                      const isSelected = selectedPkg?.id === pkg.id;
                      return (
                        <div
                          key={pkg.id}
                          className={`pkg-card ${isSelected ? "selected" : ""}`}
                          onClick={() => setSelectedPkg(isSelected ? null : pkg)}
                        >
                          <div className="pkg-net-badge" style={{ color: ni.dot }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: ni.dot, display: "inline-block"
                            }} />
                            {ni.label}
                          </div>
                          <div className="pkg-size">
                            {pkg.data_amount || pkg.volume || pkg.name}
                          </div>
                          <div className="pkg-validity">
                            {pkg.validity || "30 days"}
                          </div>
                          <div className="pkg-price">
                            GHS {pkg.selling_price.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── ORDERS TAB ── */}
          {tab === "orders" && (
            <>
              {!phone ? (
                <div className="empty-state">
                  <div className="icon">📋</div>
                  <p>Enter your phone number on the Buy Data tab<br />to view your order history.</p>
                </div>
              ) : loadingOrders ? (
                <div className="empty-state">
                  <div className="icon">⏳</div>
                  <p>Loading your orders…</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">🛍️</div>
                  <p>No orders found for {phone}.<br />Buy your first bundle!</p>
                </div>
              ) : (
                <div className="orders-list">
                  {orders.map(order => (
                    <div key={order.id} className="order-card">
                      <div className="order-left">
                        <strong>
                          {order.data_amount || order.package_name || `Package #${order.package_id}`}
                        </strong>
                        <span>
                          {netInfo(order.network_id).label} · {new Date(order.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="order-right">
                        <strong>GHS {order.amount.toFixed(2)}</strong>
                        <div className="order-status" style={{ color: statusColor(order.status) }}>
                          {order.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Checkout bar (appears when package selected) ── */}
        {selectedPkg && step === "packages" && tab === "buy" && (
          <div className="checkout-bar">
            <div className="checkout-inner">
              <div className="checkout-info">
                <strong>{selectedPkg.data_amount || selectedPkg.name}</strong>
                <span>for {phone} · {netInfo(selectedPkg.network_id).label}</span>
              </div>
              <div className="checkout-price">GHS {selectedPkg.selling_price.toFixed(2)}</div>
              <button
                className="btn-buy"
                onClick={() => setShowConfirm(true)}
                disabled={purchasing}
              >
                {purchasing ? <span className="spinner" /> : "Pay Now"}
              </button>
            </div>
          </div>
        )}

        {/* ── Confirm modal ── */}
        {showConfirm && selectedPkg && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
            <div className="modal-sheet">
              <div className="modal-handle" />
              <div className="modal-title">Confirm Purchase</div>

              <div className="confirm-row">
                <span className="label">Bundle</span>
                <span className="value">{selectedPkg.data_amount || selectedPkg.name}</span>
              </div>
              <div className="confirm-row">
                <span className="label">Network</span>
                <span className="value">{netInfo(selectedPkg.network_id).label}</span>
              </div>
              <div className="confirm-row">
                <span className="label">Validity</span>
                <span className="value">{selectedPkg.validity || "30 days"}</span>
              </div>
              <div className="confirm-row">
                <span className="label">Sending to</span>
                <span className="value">{phone}</span>
              </div>
              {name && (
                <div className="confirm-row">
                  <span className="label">Name</span>
                  <span className="value">{name}</span>
                </div>
              )}

              <div className="confirm-total">
                <span className="t-label">Total</span>
                <span className="t-price">GHS {selectedPkg.selling_price.toFixed(2)}</span>
              </div>

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setShowConfirm(false)}>
                  Cancel
                </button>
                <button
                  className="btn-confirm"
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  {purchasing ? <span className="spinner" /> : "Pay with Paystack"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
