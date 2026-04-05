/** Customer pays 1.5% on top; wallet is credited the base amount only. */
export const WALLET_DEPOSIT_FEE_RATE = 0.015;

export function chargeGhsForWalletCredit(baseCreditGhs: number): number {
  const b = Number(baseCreditGhs);
  if (Number.isNaN(b) || b <= 0) return 0;
  return Math.round(b * (1 + WALLET_DEPOSIT_FEE_RATE) * 100) / 100;
}
