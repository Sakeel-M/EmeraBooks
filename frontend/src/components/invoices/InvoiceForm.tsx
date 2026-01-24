import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoiceSchema, InvoiceFormData } from "@/lib/validations/invoice";
import { LineItemsEditor } from "@/components/invoices/LineItemsEditor";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface InvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: any;
  onSuccess: () => void;
}

export function InvoiceForm({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: InvoiceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const { toast } = useToast();
  const isEdit = !!invoice;

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: invoice?.customer_id || "",
      invoice_number: invoice?.invoice_number || "",
      invoice_date: invoice?.invoice_date ? new Date(invoice.invoice_date) : new Date(),
      due_date: invoice?.due_date ? new Date(invoice.due_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currency: invoice?.currency || "USD",
      terms: invoice?.terms || "",
      notes: invoice?.notes || "",
      status: invoice?.status || "draft",
      items: invoice?.items || [
        {
          description: "",
          quantity: 1,
          unit_price: 0,
          tax_rate: 0,
          account_id: null,
        },
      ],
    },
  });

  useEffect(() => {
    if (open) {
      fetchCustomers();
      if (!isEdit) {
        generateInvoiceNumber();
      }
    }
  }, [open, isEdit]);

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const generateInvoiceNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      let nextNumber = 1;
      if (data?.invoice_number) {
        const match = data.invoice_number.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0]) + 1;
        }
      }

      const invoiceNumber = `INV-${String(nextNumber).padStart(5, "0")}`;
      form.setValue("invoice_number", invoiceNumber);
    } catch (error: any) {
      console.error("Error generating invoice number:", error);
    }
  };

  const onSubmit = async (data: InvoiceFormData, sendInvoice: boolean = false) => {
    setIsLoading(true);
    try {
      // Calculate totals
      const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      );
      const tax_amount = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price * (item.tax_rate / 100),
        0
      );
      const total_amount = subtotal + tax_amount;

      // Prepare invoice data
      const invoiceData = {
        customer_id: data.customer_id,
        invoice_number: data.invoice_number,
        invoice_date: format(data.invoice_date, "yyyy-MM-dd"),
        due_date: format(data.due_date, "yyyy-MM-dd"),
        currency: data.currency,
        terms: data.terms || null,
        notes: data.notes || null,
        status: sendInvoice ? "sent" : data.status,
        subtotal,
        tax_amount,
        total_amount,
        amount_paid: invoice?.amount_paid || 0,
      };

      let invoiceId: string;

      if (isEdit) {
        // Update existing invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", invoice.id);

        if (invoiceError) throw invoiceError;
        invoiceId = invoice.id;

        // Delete existing line items
        const { error: deleteError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", invoice.id);

        if (deleteError) throw deleteError;
      } else {
        // Create new invoice
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert([{ ...invoiceData, user_id: user.id }])
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        invoiceId = newInvoice.id;

        // Add to inbox for review
        await supabase.from("inbox_items").insert({
          item_type: "invoice_review",
          title: `Review Invoice ${data.invoice_number}`,
          description: `Invoice for ${customers.find((c) => c.id === data.customer_id)?.name} - ${data.currency} ${total_amount.toFixed(2)}`,
          related_type: "invoice",
          related_id: invoiceId,
          priority: total_amount > 10000 ? 2 : 1,
          status: "pending",
          user_id: user.id,
        });
      }

      // Insert line items
      const lineItems = data.items.map((item) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        account_id: item.account_id || null,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(lineItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: isEdit
          ? "Invoice updated successfully"
          : sendInvoice
          ? "Invoice sent successfully"
          : "Invoice saved as draft",
      });

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update invoice details and line items" : "Fill in invoice details and add line items"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">Line Items</TabsTrigger>
                <TabsTrigger value="notes">Notes & Terms</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingCustomers ? (
                              <SelectItem value="loading" disabled>
                                Loading customers...
                              </SelectItem>
                            ) : customers.length === 0 ? (
                              <SelectItem value="none" disabled>
                                No customers found
                              </SelectItem>
                            ) : (
                              customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                  {customer.email && ` (${customer.email})`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoice_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="INV-00001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="invoice_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Invoice Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Due Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < form.watch("invoice_date")}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="items" className="mt-4">
                <LineItemsEditor form={form} />
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Payment due within 30 days..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Specify payment terms and conditions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes or comments..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Internal notes or customer-facing comments
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={form.handleSubmit((data) => onSubmit(data, false))}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save as Draft"}
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit((data) => onSubmit(data, true))}
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : isEdit ? "Update Invoice" : "Send Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
