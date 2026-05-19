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
    // Stale/invalid JWT — sign-out and let ProtectedRoute's onAuthStateChange
    // listener route to /auth via React Router. NEVER hard-reload here — the
    // initial gate-check often fires several requests in parallel, and a
    // window.location.assign would race with Supabase session rehydration and
    // cause an infinite /auth ↔ / reload loop.
    if (res.status === 401) {
      try {
        await supabase.auth.signOut();
      } catch {}
      throw new Error("unauthorized");
    }
    // Subscription gate — soft-route to /pricing. The caller's try/catch
    // (or React Query) absorbs the throw; the redirect itself is handled
    // by ProtectedRoute on next gate check, so this is just a fallback.
    if (res.status === 403 && body?.error === "subscription_required") {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/pricing")) {
        // history.pushState is React-Router-friendly; falls back to assign
        // only if React Router isn't intercepting.
        try {
          window.history.pushState({}, "", "/pricing");
          window.dispatchEvent(new PopStateEvent("popstate"));
        } catch {
          window.location.assign("/pricing");
        }
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
    let headers: Record<string, string>;
    try {
      headers = await getAuthHeaders();
    } catch (e) {
      throw new Error(
        "Could not read session — try refreshing the page and signing in again.",
      );
    }
    delete headers["Content-Type"];

    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: "POST",
        body: formData,
        headers,
      });
    } catch (e: any) {
      // fetch() throws TypeError "Failed to fetch" for genuine network
      // failures — DNS, connection drop, mid-upload abort, etc. Give the
      // user something more actionable than the raw browser string.
      if (e?.message === "Failed to fetch") {
        throw new Error(
          "Network error while uploading — check your connection or try a smaller file (max 10 MB).",
        );
      }
      throw e;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // Stale JWT — sign out and let ProtectedRoute route to /auth.
        try {
          await supabase.auth.signOut();
        } catch {}
        throw new Error("Your session expired — please sign in again.");
      }
      throw new Error(body?.error || `Request failed: ${res.status}`);
    }
    const text = await res.text();
    if (!text || text === "null") return null as T;
    return JSON.parse(text) as T;
  },
};
