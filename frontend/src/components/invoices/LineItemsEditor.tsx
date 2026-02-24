import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { InvoiceFormData } from "@/lib/validations/invoice";

interface LineItemsEditorProps {
  form: UseFormReturn<InvoiceFormData>;
}

export function LineItemsEditor({ form }: LineItemsEditorProps) {
  const items = form.watch("items");

  const addItem = () => {
    const currentItems = form.getValues("items");
    form.setValue("items", [
      ...currentItems,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
        account_id: null,
      },
    ]);
  };

  const removeItem = (index: number) => {
    const currentItems = form.getValues("items");
    if (currentItems.length > 1) {
      form.setValue(
        "items",
        currentItems.filter((_, i) => i !== index)
      );
    }
  };

  const calculateLineTotal = (index: number) => {
    const item = items[index];
    if (!item) return 0;
    const subtotal = item.quantity * item.unit_price;
    const tax = subtotal * (item.tax_rate / 100);
    return subtotal + tax;
  };

  const calculateSubtotal = () => {
    return items.reduce((total, item) => {
      return total + item.quantity * item.unit_price;
    }, 0);
  };

  const calculateTotalTax = () => {
    return items.reduce((total, item) => {
      const subtotal = item.quantity * item.unit_price;
      return total + subtotal * (item.tax_rate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTotalTax();
  };

  const formatCurrency = (amount: number) => {
    const cur = form.watch("currency") || "USD";
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(amount);
    if (cur !== "AED") return formatted;
    return formatted.replace(/AED|د\.إ\.?\s?/g, "Đ");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="min-w-[250px]">Description</TableHead>
              <TableHead className="w-24">Qty</TableHead>
              <TableHead className="w-32">Price</TableHead>
              <TableHead className="w-24">Tax %</TableHead>
              <TableHead className="w-32 text-right">Amount</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                </TableCell>
                <TableCell>
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Item description"
                            {...field}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={form.control}
                    name={`items.${index}.unit_price`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={form.control}
                    name={`items.${index}.tax_rate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(calculateLineTotal(index))}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Line Item
      </Button>

      {/* Totals Section */}
      <div className="flex justify-end">
        <div className="w-80 space-y-2">
          <div className="flex justify-between py-2 border-t">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Tax:</span>
            <span className="font-medium">{formatCurrency(calculateTotalTax())}</span>
          </div>
          <div className="flex justify-between py-3 border-t-2 border-foreground">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-lg font-bold">{formatCurrency(calculateTotal())}</span>
          </div>
        </div>
      </div>

      {form.formState.errors.items && (
        <p className="text-sm text-destructive">
          {form.formState.errors.items.message}
        </p>
      )}
    </div>
  );
}
