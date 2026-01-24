import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { billSchema, type BillFormData } from "@/lib/validations/bill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { BillLineItems } from "./BillLineItems";
import { useState } from "react";

interface BillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: any;
  onSuccess: () => void;
}

export function BillForm({ open, onOpenChange, bill, onSuccess }: BillFormProps) {
  const [activeTab, setActiveTab] = useState("details");

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

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: bill || {
      vendor_id: "",
      bill_number: `BILL-${Date.now()}`,
      bill_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      currency: "USD",
      status: "draft",
      notes: "",
      items: [
        {
          description: "",
          quantity: 1,
          unit_price: 0,
          tax_rate: 0,
          amount: 0,
        },
      ],
    },
  });

  const onSubmit = async (data: BillFormData) => {
    try {
      const totals = data.items.reduce(
        (acc, item) => {
          const subtotal = (item.quantity || 0) * (item.unit_price || 0);
          const tax = subtotal * ((item.tax_rate || 0) / 100);
          return {
            subtotal: acc.subtotal + subtotal,
            tax_amount: acc.tax_amount + tax,
            total_amount: acc.total_amount + subtotal + tax,
          };
        },
        { subtotal: 0, tax_amount: 0, total_amount: 0 }
      );

      const billData = {
        vendor_id: data.vendor_id,
        bill_number: data.bill_number,
        bill_date: data.bill_date,
        due_date: data.due_date,
        currency: data.currency,
        status: data.status,
        notes: data.notes,
        ...totals,
      };

      if (bill) {
        const { error: billError } = await supabase
          .from("bills")
          .update(billData)
          .eq("id", bill.id);
        if (billError) throw billError;

        await supabase.from("bill_items").delete().eq("bill_id", bill.id);

        const { error: itemsError } = await supabase.from("bill_items").insert(
          data.items.map((item) => ({
            bill_id: bill.id,
            description: item.description || "",
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            tax_rate: item.tax_rate,
            amount: item.amount || 0,
            account_id: item.account_id,
          }))
        );
        if (itemsError) throw itemsError;

        toast.success("Bill updated successfully");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data: newBill, error: billError } = await supabase
          .from("bills")
          .insert({ ...billData, user_id: user.id })
          .select()
          .single();
        if (billError) throw billError;

        const { error: itemsError } = await supabase.from("bill_items").insert(
          data.items.map((item) => ({
            bill_id: newBill.id,
            description: item.description || "",
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            tax_rate: item.tax_rate,
            amount: item.amount || 0,
            account_id: item.account_id,
          }))
        );
        if (itemsError) throw itemsError;

        await supabase.from("inbox_items").insert({
          item_type: "bill",
          title: `New Bill: ${data.bill_number}`,
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bill ? "Edit Bill" : "Create New Bill"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Bill Details</TabsTrigger>
                <TabsTrigger value="items">Line Items</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="vendor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors?.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bill_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill Number *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bill_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="items" className="mt-4">
                <FormField
                  control={form.control}
                  name="items"
                  render={({ field }) => (
                    <FormItem>
                      <BillLineItems items={field.value} onChange={field.onChange} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {bill ? "Update" : "Create"} Bill
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
