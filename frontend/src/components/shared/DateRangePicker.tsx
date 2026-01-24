import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  onRangeChange?: (from: Date | undefined, to: Date | undefined) => void;
}

export function DateRangePicker({ onRangeChange }: DateRangePickerProps) {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  const handleFromChange = (date: Date | undefined) => {
    setDateFrom(date);
    onRangeChange?.(date, dateTo);
  };

  const handleToChange = (date: Date | undefined) => {
    setDateTo(date);
    onRangeChange?.(dateFrom, date);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateFrom ? format(dateFrom, "PPP") : <span>From date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={dateFrom} onSelect={handleFromChange} initialFocus />
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground">to</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateTo ? format(dateTo, "PPP") : <span>To date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={dateTo} onSelect={handleToChange} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}
