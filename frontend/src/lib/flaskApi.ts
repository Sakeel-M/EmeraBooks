/**
 * Unified Flask API client.
 * Gets Supabase JWT token and sends it as Bearer header to Flask for all data requests.
 */
import { supabase } from "@/integrations/supabase/client";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  // Admin impersonation header
  const impersonateId = sessionStorage.getItem("impersonate-user-id");
  if (impersonateId) {
    headers["X-Impersonate-User"] = impersonateId;
  }
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders(options?.headers as Record<string, string>);
  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Stale/invalid JWT — force sign-out + back to /auth.
    if (res.status === 401) {
      try {
        await supabase.auth.signOut();
      } catch {}
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
        const returnTo = window.location.pathname + window.location.search;
        window.location.assign(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      }
      throw new Error("unauthorized");
    }
    // Subscription gate — redirect to /pricing instead of throwing into the React tree.
    if (res.status === 403 && body?.error === "subscription_required") {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/pricing")) {
        window.location.assign("/pricing");
      }
      throw new Error("subscription_required");
    }
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }

  // Handle null/empty responses
  const text = await res.text();
  if (!text || text === "null") return null as T;
  return JSON.parse(text) as T;
}

export const flaskApi = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: "GET" });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  del<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },

  async postForm<T>(path: string, formData: FormData): Promise<T> {
    // Multipart: build headers without forcing Content-Type so the browser
    // sets the boundary automatically.
    const headers = await getAuthHeaders();
    delete headers["Content-Type"];
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      body: formData,
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Request failed: ${res.status}`);
    }
    const text = await res.text();
    if (!text || text === "null") return null as T;
    return JSON.parse(text) as T;
  },
};
