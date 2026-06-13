import { NextResponse } from "next/server";
import { createAgentOrder, requireAgentJwt } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAgentJwt(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    recipient_msisdn?: string;
    package_id?: string | number;
    network_id?: number;
    provider_network_id?: number;
    amount?: number;
    payment_reference?: string;
    email?: string;
    customer_name?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    recipient_msisdn,
    package_id,
    network_id,
    provider_network_id,
    amount,
    payment_reference,
    email,
    customer_name,
  } = body;

  if (
    !recipient_msisdn ||
    package_id == null ||
    network_id == null ||
    amount == null ||
    !payment_reference
  ) {
    return NextResponse.json(
      { error: "Missing required order fields" },
      { status: 400 }
    );
  }

  const result = await createAgentOrder({
    storeId: auth.storeId,
    recipientMsisdn: String(recipient_msisdn),
    packageId: package_id,
    networkId: Number(network_id),
    providerNetworkId: provider_network_id,
    amount: Number(amount),
    paymentReference: String(payment_reference),
    email: email ? String(email) : undefined,
    customerName: customer_name ? String(customer_name) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, transaction_code: result.transaction_code, reference: result.reference });
}
