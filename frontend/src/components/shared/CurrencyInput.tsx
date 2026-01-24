import { Input } from "@/components/ui/input";
import { forwardRef } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  currency?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, currency = "USD", ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/[^0-9.]/g, "");
      const numValue = parseFloat(rawValue) || 0;
      onChange(numValue);
    };

    const formatValue = (val: number) => {
      return val.toFixed(2);
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {currency === "USD" ? "$" : currency}
        </span>
        <Input
          {...props}
          ref={ref}
          type="text"
          value={formatValue(value)}
          onChange={handleChange}
          className="pl-8"
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
