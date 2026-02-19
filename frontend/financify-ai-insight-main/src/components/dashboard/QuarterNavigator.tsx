import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type DateMode = "year" | "quarter" | "custom";

interface QuarterNavigatorProps {
  currentQuarter: number;
  currentYear: number;
  onNavigate: (quarter: number, year: number) => void;
  mode?: DateMode;
  onModeChange?: (mode: DateMode) => void;
  customFrom?: Date;
  customTo?: Date;
  onCustomDateChange?: (from: Date, to: Date) => void;
  modes?: DateMode[];
}

export function QuarterNavigator({
  currentQuarter, currentYear, onNavigate,
  mode = currentQuarter === 0 ? "year" : "quarter",
  onModeChange,
  customFrom, customTo, onCustomDateChange,
  modes = ["year", "quarter", "custom"],
}: QuarterNavigatorProps) {
  const label = mode === "year" ? `${currentYear}` : `Q${currentQuarter} ${currentYear}`;
  const showModeSelector = !!onModeChange;

  const handlePrev = () => {
    if (mode === "year") {
      onNavigate(0, currentYear - 1);
    } else if (currentQuarter === 1) {
      onNavigate(4, currentYear - 1);
    } else {
      onNavigate(currentQuarter - 1, currentYear);
    }
  };

  const handleNext = () => {
    if (mode === "year") {
      onNavigate(0, currentYear + 1);
    } else if (currentQuarter === 4) {
      onNavigate(1, currentYear + 1);
    } else {
      onNavigate(currentQuarter + 1, currentYear);
    }
  };

  const handleModeChange = (newMode: DateMode) => {
    if (newMode === mode) return;
    onModeChange?.(newMode);
    if (newMode === "year") {
      onNavigate(0, currentYear);
    } else if (newMode === "quarter") {
      const { quarter } = getCurrentQuarter();
      onNavigate(quarter, currentYear);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showModeSelector && (
        <div className="flex rounded-md border border-border overflow-hidden">
          {(modes as DateMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {mode !== "custom" && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[80px] text-center">
            {label}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {mode === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs font-normal">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {customFrom ? format(customFrom, "MMM dd, yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={(date) => {
                  if (date && customTo) onCustomDateChange?.(date, customTo);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs font-normal">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {customTo ? format(customTo, "MMM dd, yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={(date) => {
                  if (date && customFrom) onCustomDateChange?.(customFrom, date);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export function useQuarterDates(quarter: number, year: number) {
  return useMemo(() => {
    if (quarter === 0) {
      const from = new Date(year, 0, 1);
      const to = new Date(year, 11, 31, 23, 59, 59);
      return { from, to };
    }
    const startMonth = (quarter - 1) * 3;
    const from = new Date(year, startMonth, 1);
    const to = new Date(year, startMonth + 3, 0, 23, 59, 59);
    return { from, to };
  }, [quarter, year]);
}

export function getCurrentQuarter() {
  const now = new Date();
  return {
    quarter: Math.ceil((now.getMonth() + 1) / 3),
    year: now.getFullYear(),
  };
}
