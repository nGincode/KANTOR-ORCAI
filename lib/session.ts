"use client";

/**
 * The signed-in session, kept in one place so every API call to OUR routes can
 * present the user's access token.
 *
 * Supabase stores the session under sb-<ref>-auth-token in localStorage (or the
 * cookie variant when configured). We read it lazily instead of relying on being
 * handed the object, so a call fired from a modal still authenticates.
 */

export interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.replace(/^https:\/\//, "").split(".")[0];
}

/** reads the stored Supabase session for this project, null when signed out */
export function storedSession(): Session | null {
  if (typeof window === "undefined") return null;
  const ref = projectRef();
  if (!ref) return null;

  const candidates = [
    `sb-${ref}-auth-token`,
    `sb-${ref}-auth-token-code-verifier`,
  ];
  for (const key of candidates) {
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Partial<Session> & { currentSession?: Session };
        const session = parsed.currentSession ?? parsed;
        if (session?.access_token) return session as Session;
      } catch {
        /* malformed entry — try the next one */
      }
    }
  }
  return null;
}

/** Authorization header for our own API routes; empty when signed out */
export function authHeaders(): Record<string, string> {
  const session = storedSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}
