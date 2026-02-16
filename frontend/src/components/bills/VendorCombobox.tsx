import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Vendor {
  id: string;
  name: string;
}

interface VendorComboboxProps {
  vendors: Vendor[];
  value: string;
  onChange: (value: string) => void;
  onCreateNew: () => void;
  customVendorName: string;
  onCustomVendorNameChange: (name: string) => void;
}

export function VendorCombobox({
  vendors,
  value,
  onChange,
  onCreateNew,
  customVendorName,
  onCustomVendorNameChange,
}: VendorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Get display value
  const selectedVendor = vendors.find((v) => v.id === value);
  const displayValue = selectedVendor?.name || customVendorName || "";

  // Sync input value with display value when not open
  useEffect(() => {
    if (!open) {
      setInputValue(displayValue);
    }
  }, [displayValue, open]);

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (vendorId: string) => {
    onChange(vendorId);
    onCustomVendorNameChange(""); // Clear custom name when selecting existing vendor
    setOpen(false);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // If typing and no vendor selected, set as custom vendor name
    if (value && !vendors.find((v) => v.name.toLowerCase() === value.toLowerCase())) {
      onCustomVendorNameChange(value);
      onChange(""); // Clear vendor_id when typing custom name
    }
  };

  const handleUseCustomName = () => {
    if (inputValue.trim()) {
      onCustomVendorNameChange(inputValue.trim());
      onChange(""); // Clear vendor_id
      setOpen(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal h-10 truncate"
          >
            <span className="truncate">{displayValue || "Select or type vendor..."}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or type vendor name..."
              value={inputValue}
              onValueChange={handleInputChange}
            />
            <CommandList>
              {filteredVendors.length === 0 && !inputValue && (
                <CommandEmpty>No vendors found.</CommandEmpty>
              )}
              
              {/* Show "Use custom name" option when typing */}
              {inputValue && !vendors.find((v) => v.name.toLowerCase() === inputValue.toLowerCase()) && (
                <CommandGroup heading="New Vendor">
                  <CommandItem onSelect={handleUseCustomName}>
                    <Plus className="mr-2 h-4 w-4" />
                    Use "{inputValue}" as vendor name
                  </CommandItem>
                </CommandGroup>
              )}

              {filteredVendors.length > 0 && (
                <CommandGroup heading="Existing Vendors">
                  {filteredVendors.map((vendor) => (
                    <CommandItem
                      key={vendor.id}
                      value={vendor.id}
                      onSelect={() => handleSelect(vendor.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === vendor.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {vendor.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onCreateNew}
        title="Create new vendor with full details"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
