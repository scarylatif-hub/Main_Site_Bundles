/** Keys that must never appear in the query string (credentials, secrets). */
const SENSITIVE_QUERY_KEYS = new Set([
  "email",
  "phone",
  "phone_number",
  "fullname",
  "full_name",
  "password",
  "confirmpassword",
  "confirm_password",
  "passwd",
  "pwd",
  "pass",
  "token",
  "username",
  "user",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "refresh_token",
  "access_token",
]);

/**
 * Returns a new query string with sensitive keys removed.
 * `search` is the part after `?`, or empty.
 */
export function sanitizeSearchParamsString(search: string): {
  cleaned: string;
  changed: boolean;
} {
  const params = new URLSearchParams(search);
  let changed = false;
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.delete(key);
      changed = true;
    }
  }
  return { cleaned: params.toString(), changed };
}
