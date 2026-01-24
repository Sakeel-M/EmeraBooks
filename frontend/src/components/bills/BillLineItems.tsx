import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { BillItemFormData } from "@/lib/validations/bill";
import { CurrencyInput } from "@/components/shared/CurrencyInput";

interface BillLineItemsProps {
  items: BillItemFormData[];
  onChange: (items: BillItemFormData[]) => void;
}

export function BillLineItems({ items, onChange }: BillLineItemsProps) {
  const addItem = () => {
    onChange([
      ...items,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BillItemFormData, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Calculate amount
    const quantity = newItems[index].quantity || 0;
    const unitPrice = newItems[index].unit_price || 0;
    const taxRate = newItems[index].tax_rate || 0;
    const subtotal = quantity * unitPrice;
    newItems[index].amount = subtotal + (subtotal * taxRate / 100);
    
    onChange(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const quantity = item.quantity || 0;
      const unitPrice = item.unit_price || 0;
      return sum + (quantity * unitPrice);
    }, 0);

    const taxAmount = items.reduce((sum, item) => {
      const quantity = item.quantity || 0;
      const unitPrice = item.unit_price || 0;
      const taxRate = item.tax_rate || 0;
      const itemSubtotal = quantity * unitPrice;
      return sum + (itemSubtotal * taxRate / 100);
    }, 0);

    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 font-medium text-sm border-b">
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Quantity</div>
          <div className="col-span-2">Unit Price</div>
          <div className="col-span-2">Tax %</div>
          <div className="col-span-1">Amount</div>
          <div className="col-span-1"></div>
        </div>

        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 p-3 border-b last:border-b-0">
            <div className="col-span-4">
              <Input
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                placeholder="Item description"
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="col-span-2">
              <CurrencyInput
                value={item.unit_price}
                onChange={(value) => updateItem(index, "unit_price", value)}
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                value={item.tax_rate}
                onChange={(e) => updateItem(index, "tax_rate", parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div className="col-span-1 flex items-center">
              <span className="text-sm font-medium">
                ${(item.amount || 0).toFixed(2)}
              </span>
            </div>
            <div className="col-span-1 flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addItem} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Line Item
      </Button>

      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax:</span>
            <span className="font-medium">${totals.taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total:</span>
            <span>${totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
