interface QuarterTimelineProps {
  quarters: Array<{ label: string; count: number; quarter: number; year: number }>;
  selectedQuarter: number;
  selectedYear: number;
  onSelect: (quarter: number, year: number) => void;
}

export function QuarterTimeline({ quarters, selectedQuarter, selectedYear, onSelect }: QuarterTimelineProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {quarters.map((q) => {
        const isSelected = q.quarter === selectedQuarter && q.year === selectedYear;
        return (
          <button
            key={`${q.year}-${q.quarter}`}
            onClick={() => onSelect(q.quarter, q.year)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary hover:bg-secondary/80 text-foreground"
            }`}
          >
            <span>{q.label}</span>
            {q.count > 0 && (
              <span className={`text-xs ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {q.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
