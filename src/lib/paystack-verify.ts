export async function verifyPaystackPayment(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[paystack-verify] Missing PAYSTACK_SECRET_KEY");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.data?.status === "success";
  } catch (error) {
    console.error("[paystack-verify] request failed", error);
    return false;
  }
}
