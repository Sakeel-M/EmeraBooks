import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { simpleBillSchema, type SimpleBillFormData } from "@/lib/validations/bill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import { VendorDialog } from "@/components/vendors/VendorDialog";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { VendorCombobox } from "./VendorCombobox";
import { useCurrency } from "@/hooks/useCurrency";

interface DuplicateBillInfo {
  id: string;
  vendor_name: string;
  total_amount: number;
  bill_date: string;
}

interface BillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: any;
  onSuccess: () => void;
}

export function BillForm({ open, onOpenChange, bill, onSuccess }: BillFormProps) {
  const queryClient = useQueryClient();
  const { currency: userCurrency } = useCurrency();
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [duplicateBill, setDuplicateBill] = useState<DuplicateBillInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingBills } = useQuery({
    queryKey: ["bills-for-duplicate-check"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("id, bill_number, total_amount, vendor_id, bill_date, vendors(name)")
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<SimpleBillFormData>({
    resolver: zodResolver(simpleBillSchema),
    defaultValues: {
      vendor_id: "",
      custom_vendor_name: "",
      bill_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      amount: 0,
      status: "draft" as const,
    },
  });

  // Reset form when dialog opens/closes or bill changes
  useEffect(() => {
    if (open) {
      if (bill) {
        form.reset({
          vendor_id: bill.vendor_id || "",
          custom_vendor_name: "",
          bill_date: bill.bill_date || new Date().toISOString().split("T")[0],
          due_date: bill.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          amount: bill.total_amount || 0,
          status: bill.status || "draft",
          category: bill.category || "",
        });
      } else {
        form.reset({
          vendor_id: "",
          custom_vendor_name: "",
          bill_date: new Date().toISOString().split("T")[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          amount: 0,
          status: "draft" as const,
        });
      }
      setDuplicateBill(null);
    }
  }, [open, bill, form]);

  // Watch vendor and amount for duplicate detection
  const watchedVendorId = form.watch("vendor_id");
  const watchedAmount = form.watch("amount");

  useEffect(() => {
    if (!bill && existingBills && watchedVendorId && watchedAmount > 0) {
      const matches = existingBills.filter(b => {
        if (b.vendor_id !== watchedVendorId) return false;
        // Check if amounts are within 5% of each other
        const amountDiff = Math.abs(b.total_amount - watchedAmount);
        const threshold = watchedAmount * 0.05;
        return amountDiff <= threshold;
      });

      if (matches.length > 0) {
        setDuplicateBill({
          id: matches[0].id,
          vendor_name: (matches[0].vendors as any)?.name || "Unknown",
          total_amount: matches[0].total_amount,
          bill_date: matches[0].bill_date,
        });
      } else {
        setDuplicateBill(null);
      }
    } else {
      setDuplicateBill(null);
    }
  }, [watchedVendorId, watchedAmount, existingBills, bill]);

  const handleVendorCreated = (vendorId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
    if (vendorId) {
      form.setValue("vendor_id", vendorId);
      form.setValue("custom_vendor_name", "");
    }
    setShowVendorDialog(false);
  };

  const onSubmit = async (data: SimpleBillFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      let vendorId = data.vendor_id;

      // If custom vendor name provided, create new vendor first
      if (!vendorId && data.custom_vendor_name) {
        const { data: newVendor, error: vendorError } = await supabase
          .from("vendors")
          .insert({
            name: data.custom_vendor_name,
            user_id: user.id,
          })
          .select()
          .single();
        
        if (vendorError) throw vendorError;
        vendorId = newVendor.id;
        
        // Refresh vendors list
        queryClient.invalidateQueries({ queryKey: ["vendors"] });
      }

      if (!vendorId) {
        toast.error("Please select or enter a vendor");
        return;
      }

      const billNumber = `BILL-${Date.now()}`;
      
      const billData = {
        vendor_id: vendorId,
        bill_number: billNumber,
        bill_date: data.bill_date,
        due_date: data.due_date,
        currency: userCurrency,
        status: data.status,
        subtotal: data.amount,
        tax_amount: 0,
        total_amount: data.amount,
        category: data.category || vendors?.find(v => v.id === vendorId)?.name || null,
      };

      if (bill) {
        // Update existing bill
        const { error: billError } = await supabase
          .from("bills")
          .update({
            ...billData,
            bill_number: bill.bill_number, // Keep original bill number when editing
          })
          .eq("id", bill.id);
        if (billError) throw billError;

        // Update bill item
        await supabase.from("bill_items").delete().eq("bill_id", bill.id);
        const { error: itemsError } = await supabase.from("bill_items").insert({
          bill_id: bill.id,
          description: "Bill amount",
          quantity: 1,
          unit_price: data.amount,
          tax_rate: 0,
          amount: data.amount,
        });
        if (itemsError) throw itemsError;

        toast.success("Bill updated successfully");
      } else {
        // Create new bill
        const { data: newBill, error: billError } = await supabase
          .from("bills")
          .insert({ ...billData, user_id: user.id })
          .select()
          .single();
        if (billError) throw billError;

        // Create single bill item
        const { error: itemsError } = await supabase.from("bill_items").insert({
          bill_id: newBill.id,
          description: "Bill amount",
          quantity: 1,
          unit_price: data.amount,
          tax_rate: 0,
          amount: data.amount,
        });
        if (itemsError) throw itemsError;

        // Create inbox item
        await supabase.from("inbox_items").insert({
          item_type: "bill",
          title: `New Bill: ${billNumber}`,
          description: `Bill from vendor pending approval`,
          related_type: "bills",
          related_id: newBill.id,
          status: "pending",
          user_id: user.id,
        });

        toast.success("Bill created successfully");
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error("Failed to save bill");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{bill ? "Edit Bill" : "Create New Bill"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Vendor Selection/Input */}
              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor *</FormLabel>
                    <FormControl>
                      <VendorCombobox
                        vendors={vendors || []}
                        value={field.value || ""}
                        onChange={field.onChange}
                        onCreateNew={() => setShowVendorDialog(true)}
                        customVendorName={form.watch("custom_vendor_name") || ""}
                        onCustomVendorNameChange={(name) => form.setValue("custom_vendor_name", name)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Fields - Side by Side */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bill_date"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>Bill Date *</FormLabel>
                      <FormControl>
                        <Input type="date" className="w-full" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>Due Date *</FormLabel>
                      <FormControl>
                        <Input type="date" className="w-full" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status Field */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount Field */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        currency={userCurrency}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category Field */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <CategorySelect
                        value={field.value || ""}
                        onChange={field.onChange}
                        type="bill"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duplicate Alert */}
              {duplicateBill && (
                <Alert className="border-primary/50 bg-primary/5">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary">
                    Similar Bill Already Exists
                  </AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <div>Vendor: {duplicateBill.vendor_name}</div>
                      <div>Amount: ${duplicateBill.total_amount.toFixed(2)}</div>
                      <div>Date: {new Date(duplicateBill.bill_date).toLocaleDateString()}</div>
                    </div>
                    <p className="mt-2 text-sm">
                      You can still create this bill if needed.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : bill ? "Update Bill" : "Create Bill"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <VendorDialog
        open={showVendorDialog}
        onOpenChange={setShowVendorDialog}
        onSuccess={handleVendorCreated}
      />
    </>
  );
}
