import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldAlert,
  Check,
  X,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { flaskApi } from "@/lib/flaskApi";
import { FC } from "@/components/shared/FormattedCurrency";
import { format } from "date-fns";
import { toast } from "sonner";

interface RiskAlert {
  id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low" | string;
  title: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  amount: number | null;
  status: string;
  created_at: string;
}

const SEVERITY_TINT: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}

export default function RiskAlerts() {
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("alertId");

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["risk-alerts", clientId],
    queryFn: () =>
      flaskApi.get<RiskAlert[]>(`/clients/${clientId}/risk-alerts?status=open`),
    enabled: !!clientId,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (q) {
        const hay = `${a.title || ""} ${a.description || ""} ${a.alert_type || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, search, severityFilter]);

  // Highlight the alert referenced by ?alertId=
  useEffect(() => {
    if (!focusId || isLoading) return;
    const exists = alerts.some((a) => a.id === focusId);
    if (!exists) return;
    setHighlightId(focusId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-alert-id="${focusId}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [focusId, isLoading, alerts]);

  const updateStatus = async (alert: RiskAlert, status: "resolved" | "dismissed") => {
    setBusyId(alert.id);
    try {
      await flaskApi.patch(`/risk-alerts/${alert.id}`, { status });
      queryClient.setQueryData(["risk-alerts", clientId], (prev: RiskAlert[] | undefined) =>
        (prev || []).filter((a) => a.id !== alert.id),
      );
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-count"] });
      toast.success(status === "resolved" ? "Alert resolved" : "Alert dismissed");
      if (focusId === alert.id) setSearchParams({}, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${status === "resolved" ? "resolve" : "dismiss"} alert`);
    } finally {
      setBusyId(null);
    }
  };

  const goToTransaction = (alert: RiskAlert) => {
    if (alert.entity_type === "transaction" && alert.entity_id) {
      navigate(`/ledger?txnId=${alert.entity_id}`);
    } else if (alert.entity_type === "invoice") {
      navigate("/revenue");
    } else if (alert.entity_type === "bill") {
      navigate("/expenses");
    } else {
      toast.info("No single transaction to jump to for this alert.");
    }
  };

  const sevCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of alerts) {
      if (a.severity in c) (c as any)[a.severity] += 1;
    }
    return c;
  }, [alerts]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold font-heading gradient-text flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-500" />
              Risk Alerts
            </h1>
            <p className="text-muted-foreground">
              Open alerts across this client. Resolve or dismiss to clear them from the dashboard.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {sevCounts.critical > 0 && (
              <span className="text-red-600 font-medium">{sevCounts.critical} critical</span>
            )}
            {sevCounts.high > 0 && (
              <span className="text-orange-600 font-medium">{sevCounts.high} high</span>
            )}
            {sevCounts.medium > 0 && (
              <span className="text-amber-600 font-medium">{sevCounts.medium} medium</span>
            )}
            {sevCounts.low > 0 && (
              <span className="text-slate-600 font-medium">{sevCounts.low} low</span>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search alerts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading alerts…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <ShieldAlert className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-medium">No open alerts.</p>
                <p className="text-xs text-muted-foreground">
                  {alerts.length === 0
                    ? "Everything looks clean."
                    : "Try clearing your filter to see more."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px] text-xs">Date</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="w-[110px] text-xs">Severity</TableHead>
                      <TableHead className="w-[140px] text-xs text-right">Amount</TableHead>
                      <TableHead className="w-[180px] text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => {
                      const amt = Number(a.amount || 0);
                      const sev = a.severity || "low";
                      const tint = SEVERITY_TINT[sev] || SEVERITY_TINT.low;
                      const isClickable = !!a.entity_id;
                      const isHighlighted = highlightId === a.id;
                      return (
                        <TableRow
                          key={a.id}
                          data-alert-id={a.id}
                          data-highlight={isHighlighted ? "true" : undefined}
                          className={`${
                            isClickable ? "cursor-pointer hover:bg-muted/40" : ""
                          } data-[highlight=true]:bg-amber-50 transition-colors`}
                          onClick={() => isClickable && goToTransaction(a)}
                        >
                          <TableCell className="text-xs whitespace-nowrap py-2.5">
                            {formatDate(a.created_at)}
                          </TableCell>
                          <TableCell className="text-xs py-2.5">
                            <div className={`truncate font-medium ${isClickable ? "text-primary hover:underline" : ""}`}>
                              {a.title || a.description || a.alert_type}
                            </div>
                            {a.title && a.description && (
                              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {a.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className={`text-[10px] capitalize ${tint}`}>
                              {sev}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right py-2.5 whitespace-nowrap">
                            {amt !== 0 ? (
                              <span className={amt >= 0 ? "text-emerald-600" : "text-red-500"}>
                                {amt >= 0 ? (
                                  <ArrowUpRight className="inline h-3 w-3 mr-0.5" />
                                ) : (
                                  <ArrowDownRight className="inline h-3 w-3 mr-0.5" />
                                )}
                                <FC amount={Math.abs(amt)} currency={currency} />
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyId === a.id}
                                className="h-7 px-2 text-[11px] gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(a, "resolved");
                                }}
                              >
                                <Check className="h-3 w-3" /> Resolve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyId === a.id}
                                className="h-7 px-2 text-[11px] gap-1 border-slate-200 text-slate-600 hover:bg-slate-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(a, "dismissed");
                                }}
                              >
                                <X className="h-3 w-3" /> Dismiss
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {filtered.length > 0 && (
              <p className="text-[11px] text-muted-foreground text-right">
                Showing {filtered.length} of {alerts.length} open alert{alerts.length === 1 ? "" : "s"}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
