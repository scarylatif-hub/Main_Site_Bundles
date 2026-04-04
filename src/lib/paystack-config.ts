/**
 * Paystack Configuration and Helper Functions
 * Handles fee calculations, charge splitting, and platform fees
 */

export const PAYSTACK_CONFIG = {
  PLATFORM_FEE_PERCENTAGE: 1.5, // 1.5% platform fee
  WALLET_DEPOSIT_MIN: 1.0, // Minimum wallet deposit in GHS
  CART_PURCHASE_MIN: 1.0, // Minimum cart purchase in GHS
};

/**
 * Calculate fee for wallet deposits
 * Platform takes 1.5% on top of deposit amount
 */
export function walletDepositChargeFromBaseGhs(baseGhs: number): {
  baseGhs: number;
  platformFeeGhs: number;
  chargeGhs: number;
} {
  const platformFeeGhs = baseGhs * (PAYSTACK_CONFIG.PLATFORM_FEE_PERCENTAGE / 100);
  return {
    baseGhs,
    platformFeeGhs,
    chargeGhs: baseGhs + platformFeeGhs,
  };
}

/**
 * Calculate fee for cart purchases (usually no fee or minimal)
 */
export function cartPaystackChargeFromBaseGhs(baseGhs: number): {
  baseGhs: number;
  platformFeeGhs: number;
  chargeGhs: number;
} {
  // For cart purchases, no additional platform fee - wallet is already funded
  return {
    baseGhs,
    platformFeeGhs: 0,
    chargeGhs: baseGhs,
  };
}

export const MIN_WALLET_DEPOSIT_BASE_GHS = PAYSTACK_CONFIG.WALLET_DEPOSIT_MIN;

/**
 * Format price for Paystack (convert GHS to pesewas/cents)
 */
export function toPaystackAmount(ghs: number): number {
  return Math.round(ghs * 100); // Convert GHS to pesewas
}

/**
 * Generate unique transaction reference for Paystack
 */
export function generatePaystackReference(userId: string, type: 'wallet' | 'purchase'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${type.toUpperCase()}_${userId.substring(0, 8)}_${timestamp}_${random}`;
}

/**
 * Verify Paystack webhook signature
 */
export function verifyPaystackSignature(
  signature: string,
  body: string,
  secret: string
): boolean {
  const hash = require('crypto')
    .createHmac('sha512', secret)
    .update(body)
    .digest('hex');
  return hash === signature;
}
