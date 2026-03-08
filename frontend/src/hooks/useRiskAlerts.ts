import { useQuery } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";
import { useActiveClient } from "./useActiveClient";

interface AlertBreakdown {
  riskAlerts: number;
  anomalies: number;
  flaggedRecon: number;
  overdueInvoices: number;
  overdueBills: number;
}

interface RiskAlertSummary {
  alertCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  breakdown?: AlertBreakdown;
}

const emptyBreakdown: AlertBreakdown = {
  riskAlerts: 0, anomalies: 0, flaggedRecon: 0, overdueInvoices: 0, overdueBills: 0,
};

export function useRiskAlerts() {
  const { clientId } = useActiveClient();

  const { data, isLoading } = useQuery({
    queryKey: ["risk-alerts-count", clientId],
    queryFn: () =>
      flaskApi.get<RiskAlertSummary>(`/clients/${clientId}/risk-alerts/summary`),
    enabled: !!clientId,
    refetchInterval: 60_000,
  });

  const bySeverity = {
    critical: data?.critical ?? 0,
    high: data?.high ?? 0,
    medium: data?.medium ?? 0,
    low: data?.low ?? 0,
  };

  const breakdown = data?.breakdown ?? emptyBreakdown;

  return {
    alertCount: data?.alertCount ?? 0,
    totalOpen: data?.alertCount ?? 0,
    bySeverity,
    breakdown,
    critical: bySeverity.critical,
    high: bySeverity.high,
    medium: bySeverity.medium,
    low: bySeverity.low,
    isLoading,
  };
}
