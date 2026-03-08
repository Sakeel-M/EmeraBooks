import { ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ClientSwitcher } from "./ClientSwitcher";
import { NotificationBell } from "./NotificationBell";
import { DateRangeContext } from "@/hooks/useDateRange";
import { useActiveClient } from "@/hooks/useActiveClient";
import { database } from "@/lib/database";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle, RefreshCw } from "lucide-react";
import { format, subMonths, subYears, startOfYear } from "date-fns";
import { toast } from "sonner";

interface LayoutProps {
  children: ReactNode;
}

const LS_KEY_PREFIX = "emara-date-range-";

function getStoredRange(clientId: string | null) {
  if (!clientId) return null;
  try {
    const raw = localStorage.getItem(LS_KEY_PREFIX + clientId);
    if (raw) return JSON.parse(raw) as { startDate: string; endDate: string };
  } catch {}
  return null;
}

function storeRange(clientId: string | null, start: string, end: string) {
  if (!clientId) return;
  localStorage.setItem(LS_KEY_PREFIX + clientId, JSON.stringify({ startDate: start, endDate: end }));
}

export function Layout({ children }: LayoutProps) {
  const { clientId } = useActiveClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"start" | "end">("start");

  // Auto-detect date range from backend; use localStorage only as brief visual fallback
  useEffect(() => {
    if (!clientId) return;
    // Apply stored range immediately as visual placeholder (prevents flash)
    const stored = getStoredRange(clientId);
    if (stored) {
      setStartDate(stored.startDate);
      setEndDate(stored.endDate);
    }
    // ALWAYS call backend to get real range (stored may be stale)
    setIsDetecting(true);
    database.getTransactionDateRange(clientId).then((r) => {
      setBackendReachable(true);
      if (r.min_date && r.max_date) {
        setStartDate(r.min_date);
        setEndDate(r.max_date);
        storeRange(clientId, r.min_date, r.max_date);
      } else if (!stored) {
        // No data at all and no cache — fallback to last 12 months
        const now = new Date();
        setStartDate(format(subMonths(now, 12), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
      }
    }).catch(() => {
      setBackendReachable(false);
      if (!stored) {
        const now = new Date();
        setStartDate(format(subMonths(now, 12), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
      }
    }).finally(() => setIsDetecting(false));
  }, [clientId]);

  const setDateRange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    storeRange(clientId, start, end);
  }, [clientId]);

  const refreshDateRange = useCallback(() => {
    if (!clientId) return;
    localStorage.removeItem(LS_KEY_PREFIX + clientId);
    setIsDetecting(true);
    database.getTransactionDateRange(clientId).then((r) => {
      setBackendReachable(true);
      if (r.min_date && r.max_date) {
        setStartDate(r.min_date);
        setEndDate(r.max_date);
        storeRange(clientId, r.min_date, r.max_date);
      }
    }).catch(() => {
      setBackendReachable(false);
    }).finally(() => setIsDetecting(false));
  }, [clientId]);

  const ctxValue = useMemo(() => ({
    startDate, endDate, setDateRange, isDetecting, refreshDateRange, backendReachable,
  }), [startDate, endDate, setDateRange, isDetecting, refreshDateRange, backendReachable]);

  // Preset handlers
  const applyPreset = (preset: string) => {
    const now = new Date();
    let s: string, e: string;
    switch (preset) {
      case "last3":
        s = format(subMonths(now, 3), "yyyy-MM-dd");
        e = format(now, "yyyy-MM-dd");
        break;
      case "last6":
        s = format(subMonths(now, 6), "yyyy-MM-dd");
        e = format(now, "yyyy-MM-dd");
        break;
      case "last12":
        s = format(subMonths(now, 12), "yyyy-MM-dd");
        e = format(now, "yyyy-MM-dd");
        break;
      case "thisYear":
        s = format(startOfYear(now), "yyyy-MM-dd");
        e = format(now, "yyyy-MM-dd");
        break;
      case "lastYear":
        s = format(startOfYear(subYears(now, 1)), "yyyy-MM-dd");
        e = format(new Date(now.getFullYear() - 1, 11, 31), "yyyy-MM-dd");
        break;
      case "all":
      default: {
        setOpen(false);
        if (!clientId) return;
        setIsDetecting(true);
        database.getTransactionDateRange(clientId).then((r) => {
          setBackendReachable(true);
          if (r.min_date && r.max_date) {
            setDateRange(r.min_date, r.max_date);
          } else {
            const now = new Date();
            setDateRange(format(subMonths(now, 12), "yyyy-MM-dd"), format(now, "yyyy-MM-dd"));
          }
        }).catch(() => {
          setBackendReachable(false);
          const stored = getStoredRange(clientId);
          if (stored) {
            setDateRange(stored.startDate, stored.endDate);
          } else {
            const now = new Date();
            setDateRange(format(subMonths(now, 12), "yyyy-MM-dd"), format(now, "yyyy-MM-dd"));
          }
          toast.error("Backend not reachable — using cached date range");
        }).finally(() => setIsDetecting(false));
        return;
      }
    }
    setDateRange(s, e);
    setOpen(false);
  };

  const formatLabel = () => {
    if (!startDate || !endDate) return "Select dates";
    try {
      const s = new Date(startDate + "T00:00:00");
      const e = new Date(endDate + "T00:00:00");
      if (s.getFullYear() === e.getFullYear()) {
        return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
      }
      return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
    } catch {
      return "Select dates";
    }
  };

  return (
    <DateRangeContext.Provider value={ctxValue}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex-1 min-w-0">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-2 sm:gap-4 border-b bg-card/50 backdrop-blur-sm px-2 sm:px-4 min-w-0">
              <SidebarTrigger className="shrink-0" />
              <ClientSwitcher />
              <div className="flex-1 min-w-0" />

              {/* Date Range Picker */}
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs font-medium max-w-[200px] sm:max-w-none"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatLabel()}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <div className="flex">
                    {/* Presets */}
                    <div className="border-r p-3 space-y-1 min-w-[130px]">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Quick Select
                      </p>
                      {[
                        { key: "all", label: "All Data" },
                        { key: "last3", label: "Last 3 Months" },
                        { key: "last6", label: "Last 6 Months" },
                        { key: "last12", label: "Last 12 Months" },
                        { key: "thisYear", label: "This Year" },
                        { key: "lastYear", label: "Last Year" },
                      ].map((p) => (
                        <Button
                          key={p.key}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            applyPreset(p.key);
                          }}
                        >
                          {p.label}
                        </Button>
                      ))}
                    </div>

                    {/* Calendar */}
                    <div className="p-3">
                      <div className="flex gap-2 mb-2">
                        <Button
                          variant={calendarMode === "start" ? "default" : "outline"}
                          size="sm"
                          className="text-[10px] h-6 flex-1"
                          onClick={() => setCalendarMode("start")}
                        >
                          From: {startDate ? format(new Date(startDate + "T00:00:00"), "MMM d, yyyy") : "—"}
                        </Button>
                        <Button
                          variant={calendarMode === "end" ? "default" : "outline"}
                          size="sm"
                          className="text-[10px] h-6 flex-1"
                          onClick={() => setCalendarMode("end")}
                        >
                          To: {endDate ? format(new Date(endDate + "T00:00:00"), "MMM d, yyyy") : "—"}
                        </Button>
                      </div>
                      <Calendar
                        mode="single"
                        selected={
                          calendarMode === "start" && startDate
                            ? new Date(startDate + "T00:00:00")
                            : calendarMode === "end" && endDate
                              ? new Date(endDate + "T00:00:00")
                              : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;
                          const formatted = format(date, "yyyy-MM-dd");
                          if (calendarMode === "start") {
                            const newEnd = endDate && formatted > endDate ? formatted : endDate;
                            setDateRange(formatted, newEnd);
                            setCalendarMode("end");
                          } else {
                            const newStart = startDate && formatted < startDate ? formatted : startDate;
                            setDateRange(newStart, formatted);
                          }
                        }}
                        defaultMonth={
                          calendarMode === "start" && startDate
                            ? new Date(startDate + "T00:00:00")
                            : calendarMode === "end" && endDate
                              ? new Date(endDate + "T00:00:00")
                              : undefined
                        }
                        numberOfMonths={1}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <NotificationBell />
            </header>
            {backendReachable === false && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Backend not reachable — data and charts will not load. Ensure Flask is running on port 5000.</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs ml-auto gap-1"
                  onClick={() => {
                    refreshDateRange();
                    toast("Retrying connection...");
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            )}
            <main className="flex-1 p-3 sm:p-6">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </DateRangeContext.Provider>
  );
}
