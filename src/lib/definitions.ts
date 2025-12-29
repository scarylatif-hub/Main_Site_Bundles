export type NetworkName = 'MTN' | 'Telecel' | 'AirtelTigo';

export interface Network {
  id: number;
  name: NetworkName;
  prefixes: string[];
}

export interface Package {
  id: string; // Using sharedBundle as unique id
  network: Network;
  dataAmount: string;
  validity: string;
  price: number;
  sharedBundle: number;
}

export interface CartItem {
  cartId: string; // A unique ID for the cart item
  recipientMsisdn: string;
  networkId: number;
  networkName: NetworkName;
  sharedBundle: number;
  price: number;
  dataAmount: string;
}

// This type now matches the `transactions` table in your SQL schema.
export type Transaction = {
    id: string;
    user_id: string;
    transaction_code: string | null;
    transaction_type: string;
    recipient_msisdn: string | null;
    network_id: number | null;
    shared_bundle: number | null;
    bundle_amount: string | null;
    amount: number;
    status: string;
    description: string | null;
    balance_before: number | null;
    balance_after: number | null;
    created_at: string;
};
