export type NetworkName = 'MTN' | 'Telecel' | 'AirtelTigo';

export interface Network {
  id: number;
  name: NetworkName;
  prefixes: string[];
}

export interface Package {
  id: string; 
  network: {
    id: number;
    name: NetworkName;
  };
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
    /** Canonical id shared with provider / Paystack (after migration 004). */
    reference?: string | null;
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

// This type now reflects the data fetched from the backend and used in the frontend
export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  wallet_balance: number;
  is_admin: boolean;
  is_reseller?: boolean;
  store_name?: string;
  reseller_approved?: boolean;
  updated_at: string;
};
