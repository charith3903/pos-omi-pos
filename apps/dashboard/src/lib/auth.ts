'use client';

const SESSION_KEY = 'omnipos_session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: string; tenantId: string };
  tenant: { id: string; name: string; subdomain: string; businessType?: string };
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return getSession()?.accessToken ?? null;
}
