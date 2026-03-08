import { createContext, useContext } from "react";

export interface DateRangeContextValue {
  startDate: string; // "yyyy-MM-dd"
  endDate: string;   // "yyyy-MM-dd"
  setDateRange: (start: string, end: string) => void;
  /** True while auto-detecting date range from backend */
  isDetecting: boolean;
  /** Clears localStorage cache and re-fetches date range from backend */
  refreshDateRange: () => void;
  /** null = checking, true = ok, false = backend not reachable */
  backendReachable: boolean | null;
}

export const DateRangeContext = createContext<DateRangeContextValue>({
  startDate: "",
  endDate: "",
  setDateRange: () => {},
  isDetecting: false,
  refreshDateRange: () => {},
  backendReachable: null,
});

export function useDateRange() {
  return useContext(DateRangeContext);
}
