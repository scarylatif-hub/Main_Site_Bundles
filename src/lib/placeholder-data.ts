import type { Transaction } from './definitions';

// Note: The PACKAGES constant is now deprecated as data is fetched from the API.
// It is kept here for reference and potential fallback, but is no longer used in the main application flow.
export const PACKAGES: any[] = [];

export const ORDERS: Transaction[] = [
    {
        id: '1',
        user_id: 'user-1',
        transaction_code: 'TXN123456',
        transaction_type: 'purchase',
        recipient_msisdn: '0241234567',
        network_id: 1,
        shared_bundle: null,
        bundle_amount: '5 GB',
        amount: -45.00,
        status: 'success',
        description: 'Purchase of 5 GB for 0241234567',
        balance_before: 100,
        balance_after: 55,
        created_at: new Date('2024-07-28T10:30:00Z').toISOString(),
    },
    {
        id: '2',
        user_id: 'user-1',
        transaction_code: 'TXN123457',
        transaction_type: 'purchase',
        recipient_msisdn: '0209876543',
        network_id: 2,
        shared_bundle: null,
        bundle_amount: '1.5 GB',
        amount: -10.00,
        status: 'success',
        description: 'Purchase of 1.5 GB for 0209876543',
        balance_before: 55,
        balance_after: 45,
        created_at: new Date('2024-07-28T11:00:00Z').toISOString(),
    },
    {
        id: '3',
        user_id: 'user-1',
        transaction_code: 'TXN123458',
        transaction_type: 'purchase',
        recipient_msisdn: '0271112222',
        network_id: 3,
        shared_bundle: null,
        bundle_amount: '2.5 GB',
        amount: -20.00,
        status: 'failed',
        description: 'Failed purchase of 2.5 GB for 0271112222',
        balance_before: 45,
        balance_after: 45,
        created_at: new Date('2024-07-27T15:45:00Z').toISOString(),
    },
];
