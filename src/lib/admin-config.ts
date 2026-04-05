/** Sole admin — portal and admin APIs allow only this account. */
export const ADMIN_EMAIL = "scarylatif@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
