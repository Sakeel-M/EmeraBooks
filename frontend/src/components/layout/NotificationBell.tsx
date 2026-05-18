import { useState } from "react";
import { Bell, AlertTriangle, Activity, Flag, FileWarning, Receipt, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRiskAlerts } from "@/hooks/useRiskAlerts";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AlertRow {
  key: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  href: string;
  tint: string;
}

export function NotificationBell() {
  const { totalOpen, bySeverity, breakdown } = useRiskAlerts();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const flagCount = (breakdown.flaggedRecon || 0) + (breakdown.overdueInvoices || 0) + (breakdown.overdueBills || 0);
  const grandTotal = totalOpen + flagCount;

  const rows: AlertRow[] = [
    {
      key: "risk",
      label: "Risk Alerts",
      count: breakdown.riskAlerts || 0,
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      href: "/",
      tint: "hover:bg-red-50",
    },
    {
      key: "anomaly",
      label: "Anomalies Detected",
      count: breakdown.anomalies || 0,
      icon: <Activity className="h-4 w-4 text-amber-500" />,
      href: "/",
      tint: "hover:bg-amber-50",
    },
    {
      key: "flagged",
      label: "Flagged Reconciliation",
      count: breakdown.flaggedRecon || 0,
      icon: <Flag className="h-4 w-4 text-orange-500" />,
      href: "/reconciliation",
      tint: "hover:bg-orange-50",
    },
    {
      key: "ovinv",
      label: "Overdue Invoices",
      count: breakdown.overdueInvoices || 0,
      icon: <FileWarning className="h-4 w-4 text-rose-500" />,
      href: "/revenue",
      tint: "hover:bg-rose-50",
    },
    {
      key: "ovbills",
      label: "Overdue Bills",
      count: breakdown.overdueBills || 0,
      icon: <Receipt className="h-4 w-4 text-rose-500" />,
      href: "/expenses",
      tint: "hover:bg-rose-50",
    },
  ];

  const visibleRows = rows.filter((r) => r.count > 0);

  const handleGo = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {grandTotal > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center"
            >
              {grandTotal > 99 ? "99+" : grandTotal}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {grandTotal === 0
                ? "You're all clear"
                : `${grandTotal} item${grandTotal > 1 ? "s" : ""} need attention`}
            </p>
          </div>
          {grandTotal > 0 && (
            <Badge variant="destructive" className="text-[10px]">{grandTotal}</Badge>
          )}
        </div>

        {grandTotal === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No active alerts. Everything looks good.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {visibleRows.map((r) => (
              <button
                key={r.key}
                onClick={() => handleGo(r.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b last:border-b-0 text-left transition-colors ${r.tint}`}
              >
                <div className="shrink-0">{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.label}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">{r.count}</Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}

        {totalOpen > 0 && (bySeverity.critical > 0 || bySeverity.high > 0 || bySeverity.medium > 0 || bySeverity.low > 0) && (
          <div className="border-t px-4 py-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Severity:</span>
            {bySeverity.critical > 0 && <span className="text-red-600 font-medium">{bySeverity.critical} critical</span>}
            {bySeverity.high > 0 && <span className="text-orange-600 font-medium">{bySeverity.high} high</span>}
            {bySeverity.medium > 0 && <span className="text-amber-600 font-medium">{bySeverity.medium} medium</span>}
            {bySeverity.low > 0 && <span className="text-slate-600 font-medium">{bySeverity.low} low</span>}
          </div>
        )}

        <div className="border-t px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => handleGo("/")}
          >
            View dashboard
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
