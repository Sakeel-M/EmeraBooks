import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

interface QuarterNavigatorProps {
  currentQuarter: number; // 1-4, or 0 for full year
  currentYear: number;
  onNavigate: (quarter: number, year: number) => void;
  allowYearMode?: boolean;
}

export function QuarterNavigator({ currentQuarter, currentYear, onNavigate, allowYearMode = false }: QuarterNavigatorProps) {
  const isYearMode = currentQuarter === 0;
  const label = isYearMode ? `${currentYear}` : `Q${currentQuarter} ${currentYear}`;

  const handlePrev = () => {
    if (isYearMode) {
      onNavigate(0, currentYear - 1);
    } else if (currentQuarter === 1) {
      onNavigate(4, currentYear - 1);
    } else {
      onNavigate(currentQuarter - 1, currentYear);
    }
  };

  const handleNext = () => {
    if (isYearMode) {
      onNavigate(0, currentYear + 1);
    } else if (currentQuarter === 4) {
      onNavigate(1, currentYear + 1);
    } else {
      onNavigate(currentQuarter + 1, currentYear);
    }
  };

  const toggleMode = () => {
    if (!allowYearMode) return;
    if (isYearMode) {
      const { quarter } = getCurrentQuarter();
      onNavigate(quarter, currentYear);
    } else {
      onNavigate(0, currentYear);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span
        className={`text-sm font-semibold text-foreground min-w-[80px] text-center ${allowYearMode ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
        onClick={toggleMode}
        title={allowYearMode ? (isYearMode ? "Switch to quarterly" : "Switch to yearly") : undefined}
      >
        {label}
      </span>
      <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function useQuarterDates(quarter: number, year: number) {
  return useMemo(() => {
    if (quarter === 0) {
      // Full year mode
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
