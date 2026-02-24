// In development the Vite dev-server proxy forwards /api → http://127.0.0.1:5000
// (no CORS needed). For production, set VITE_API_BASE_URL to the absolute backend URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const API_SECRET_KEY = import.meta.env.VITE_API_SECRET_KEY || "";

/** Returns headers that include the API key when one is configured. */
function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
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
      headers: apiHeaders(),
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
        headers: apiHeaders({ "Content-Type": "application/json" }),
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
    const response = await fetch(`${API_BASE_URL}/health`, { headers: apiHeaders() });
    return response.json();
  },
};
