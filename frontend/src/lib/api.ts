const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://72.60.222.167/api";
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
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    return response.json();
  },

  async analyzeData(data: any[], bankInfo: any): Promise<AnalysisResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.json();
  },
};
