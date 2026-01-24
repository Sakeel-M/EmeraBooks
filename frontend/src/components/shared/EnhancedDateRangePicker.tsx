import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";

interface EnhancedDateRangePickerProps {
  onRangeChange?: (from: Date, to: Date) => void;
  defaultRange?: { from: Date; to: Date };
}

export function EnhancedDateRangePicker({ onRangeChange, defaultRange }: EnhancedDateRangePickerProps) {
  const [from, setFrom] = useState<Date>(defaultRange?.from || startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(defaultRange?.to || endOfMonth(new Date()));

  const handlePreset = (preset: string) => {
    const today = new Date();
    let newFrom: Date;
    let newTo: Date = today;

    switch (preset) {
      case 'today':
        newFrom = today;
        break;
      case 'last7':
        newFrom = subDays(today, 7);
        break;
      case 'last30':
        newFrom = subDays(today, 30);
        break;
      case 'thisMonth':
        newFrom = startOfMonth(today);
        newTo = endOfMonth(today);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        newFrom = startOfMonth(lastMonth);
        newTo = endOfMonth(lastMonth);
        break;
      case 'thisYear':
        newFrom = startOfYear(today);
        newTo = endOfYear(today);
        break;
      default:
        return;
    }

    setFrom(newFrom);
    setTo(newTo);
    onRangeChange?.(newFrom, newTo);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(from, "MMM dd, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={from}
              onSelect={(date) => {
                if (date) {
                  setFrom(date);
                  onRangeChange?.(date, to);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <span className="flex items-center text-muted-foreground">to</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(to, "MMM dd, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={to}
              onSelect={(date) => {
                if (date) {
                  setTo(date);
                  onRangeChange?.(from, date);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handlePreset('today')}>
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={() => handlePreset('last7')}>
          Last 7 Days
        </Button>
        <Button variant="outline" size="sm" onClick={() => handlePreset('last30')}>
          Last 30 Days
        </Button>
        <Button variant="outline" size="sm" onClick={() => handlePreset('thisMonth')}>
          This Month
        </Button>
        <Button variant="outline" size="sm" onClick={() => handlePreset('lastMonth')}>
          Last Month
        </Button>
        <Button variant="outline" size="sm" onClick={() => handlePreset('thisYear')}>
          This Year
        </Button>
      </div>
    </div>
  );
}
