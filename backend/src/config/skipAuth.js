/**
 * SKIP_AUTH: when "true" or "1", all auth and CSRF checks are bypassed.
 * Use only in trusted/dev or cookie-free environments (e.g. HTTP without cookies).
 */

export function isSkipAuth() {
  const v = process.env.SKIP_AUTH;
  return v === "true" || v === "1";
}

/** Mock user attached to req when SKIP_AUTH is on (so handlers can use req.user). */
export const MOCK_USER = Object.freeze({
  id: "skip-auth",
  login: "skip",
  username: "Skip Auth",
});
