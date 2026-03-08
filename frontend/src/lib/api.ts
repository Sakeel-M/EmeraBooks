// In development the Vite dev-server proxy forwards /api → http://127.0.0.1:5000
// (no CORS needed). For production, set VITE_API_BASE_URL to the absolute backend URL.
import { supabase } from "@/integrations/supabase/client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const API_SECRET_KEY = import.meta.env.VITE_API_SECRET_KEY || "";

/** Returns headers with Bearer JWT token (preferred) and optional API key (legacy). */
async function apiHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  // Add Supabase JWT as Bearer token
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  // Keep API key for backward compat
  if (API_SECRET_KEY) headers["X-API-Key"] = API_SECRET_KEY;
  return headers;
}

export interface UploadResponse {
  message: string;
  data: any[];
  full_data: any[];
  bank_info: {
    bank_name: string;
    currency: string;
    country: string;
    bank_code: string;
  };
  total_rows: number;
}

export interface AnalysisResponse {
  ai_analysis: any;
  basic_statistics: any;
  bank_info: any;
  data_overview: any;
}

export const api = {
  async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: await apiHeaders(),
      body: formData,
    });

    if (!response.ok) {
      let msg = `Server error ${response.status}`;
      try {
        const body = await response.json();
        if (body?.error) msg = body.error;
      } catch {}
      throw new Error(msg);
    }

    return response.json();
  },

  async analyzeData(data: any[], bankInfo: any): Promise<AnalysisResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: await apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          data,
          bank_info: bankInfo,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error("Analysis timed out. The server may be busy, please try again.");
      }
      throw error;
    }
  },

  async healthCheck(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/health`, { headers: await apiHeaders() });
    return response.json();
  },

  async aiInsights(payload: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    transactionCount: number;
    topCategories: { name: string; amount: number }[];
    currency: string;
    periodFrom: string;
    periodTo: string;
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/ai-insights`, {
      method: "POST",
      headers: await apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let msg = `Server error ${response.status}`;
      try {
        const body = await response.json();
        if (body?.error) msg = body.error;
      } catch {}
      throw new Error(msg);
    }

    return response.json();
  },

  // ── v2 Reconciliation API ────────────────────────────────────────────
  async reconcile(payload: {
    source_a_transactions: { id: string; date: string; description: string; amount: number }[];
    source_b_transactions: { id: string; date: string; description: string; amount: number }[];
    bills?: any[];
    invoices?: any[];
    rules?: any[];
  }): Promise<{
    matched: any[];
    flagged: any[];
    match_count: number;
    flag_count: number;
    match_rate: number;
    total_discrepancy: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/reconcile`, {
      method: "POST",
      headers: await apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `Reconciliation failed (${response.status})`);
    }
    return response.json();
  },

  // ── v2 Risk Score API ────────────────────────────────────────────────
  async riskScore(metrics: {
    recon_match_rate: number;
    alerts_resolved_pct: number;
    ar_health_pct: number;
    ap_health_pct: number;
    data_freshness_pct: number;
  }): Promise<{
    overall_score: number;
    risk_level: string;
    breakdown: { category: string; raw_score: number; weight: number; weighted_score: number }[];
  }> {
    const response = await fetch(`${API_BASE_URL}/risk/score`, {
      method: "POST",
      headers: await apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ metrics }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `Risk scoring failed (${response.status})`);
    }
    return response.json();
  },

  // ── v2 Variance Detection API ────────────────────────────────────────
  async varianceDetect(payload: {
    current_value: number;
    baseline_value: number;
    std_deviation: number | null;
    threshold_sigma?: number;
  }): Promise<{
    is_anomaly: boolean;
    z_score: number;
    direction: string;
    severity: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/variance/detect`, {
      method: "POST",
      headers: await apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `Variance detection failed (${response.status})`);
    }
    return response.json();
  },

  async varianceBaselines(payload: {
    transactions: { date: string; amount: number; category: string }[];
    period_type?: string;
  }): Promise<{
    baselines: { metric_name: string; value: number; std_dev: number; sample_count: number }[];
  }> {
    const response = await fetch(`${API_BASE_URL}/variance/compute-baselines`, {
      method: "POST",
      headers: await apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `Baseline computation failed (${response.status})`);
    }
    return response.json();
  },
};
