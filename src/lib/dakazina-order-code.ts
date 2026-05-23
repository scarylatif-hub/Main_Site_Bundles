/**
 * Extract Dakazina's canonical order identifier.
 * Dakazina returns transaction_code like "926TEST-0020595919802"
 * NOT "ORDER-XXXXXX" format in their API response.
 */

const ORDER_CODE_KEYS = [
  "order_code",
  "orderCode",
  "transaction_code",   // ← ADD THIS — this is what Dakazina actually returns
  "transactionCode",    // ← ADD THIS — camelCase variant
] as const;

const ORDER_CODE_IN_TEXT_RE = /\b(ORDER-\d+|DKZ-[A-Z0-9-]+)\b/i;

export function looksLikeDakazinaOrderCode(value: string): boolean {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return false;
  return (
    /^ORDER-\d+$/i.test(trimmed) ||
    /^DKZ-[A-Z0-9-]+$/i.test(trimmed) ||
    /^926[A-Z0-9-]+$/i.test(trimmed)   // ← ADD THIS — matches "926TEST-002..." format
  );
}

function pickString(
  data: Record<string, unknown>,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function unwrapProviderPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return {};
  }
  const o = data as Record<string, unknown>;
  const inner = o.data ?? o.order ?? o.transaction ?? o.result;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return { ...o, ...(inner as Record<string, unknown>) };
  }
  return o;
}

function deepFindOrderCode(value: unknown, depth = 0): string | null {
  if (depth > 8) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (looksLikeDakazinaOrderCode(trimmed)) {
      return trimmed.toUpperCase();
    }
    const match = trimmed.match(ORDER_CODE_IN_TEXT_RE);
    if (match) return match[1].toUpperCase();
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindOrderCode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ORDER_CODE_KEYS) {
      const candidate = o[key];
      if (candidate != null) {
        const found = deepFindOrderCode(candidate, depth + 1);
        if (found) return found;
      }
    }
    for (const v of Object.values(o)) {
      const found = deepFindOrderCode(v, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

export function extractDakazinaOrderCode(
  data: Record<string, unknown>,
  fallback: string
): string {
  const unwrapped = unwrapProviderPayload(data);

  const deep = deepFindOrderCode(unwrapped);
  if (deep) return deep;

  const orderCode = pickString(unwrapped, ORDER_CODE_KEYS);
  if (orderCode) {
    return orderCode.trim();
  }

  return fallback.trim() || fallback;
}