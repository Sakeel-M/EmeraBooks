import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { invoiceSchema, InvoiceFormData } from "@/lib/validations/invoice";
import { LineItemsEditor } from "@/components/invoices/LineItemsEditor";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function InvoiceFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!id);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadedData, setLoadedData] = useState<InvoiceFormData | null>(null);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: "",
      invoice_number: "",
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currency: "USD",
      terms: "",
      notes: "",
      status: "draft",
      items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 0, account_id: null }],
    },
  });

  // Fetch customers
  useEffect(() => {
    supabase
      .from("customers")
      .select("id, name, email")
      .order("name")
      .then(({ data }) => setCustomers(data || []));
  }, []);

  // Fetch invoice data for edit mode
  useEffect(() => {
    if (!id) {
      generateInvoiceNumber();
      return;
    }
    setIsFetching(true);
    Promise.all([
      supabase.from("invoices").select("*").eq("id", id).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id),
    ]).then(([{ data: inv, error: invErr }, { data: existingItems }]) => {
      if (invErr || !inv) {
        toast({ title: "Error", description: "Invoice not found", variant: "destructive" });
        navigate("/invoices");
        return;
      }
      const items =
        existingItems && existingItems.length > 0
          ? existingItems.map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              tax_rate: Number(item.tax_rate || 0),
              account_id: item.account_id || null,
            }))
          : [{ description: "", quantity: 1, unit_price: 0, tax_rate: 0, account_id: null }];

      const formData: InvoiceFormData = {
        customer_id: inv.customer_id || "",
        invoice_number: inv.invoice_number || "",
        invoice_date: inv.invoice_date ? parseLocalDate(inv.invoice_date) : new Date(),
        due_date: inv.due_date ? parseLocalDate(inv.due_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: inv.currency || "USD",
        terms: inv.terms || "",
        notes: inv.notes || "",
        status: inv.status || "draft",
        items,
      };
      setLoadedData(formData);
      setIsFetching(false);
    });
  }, [id]);

  // Reset form AFTER fields have mounted
  useEffect(() => {
    if (loadedData) {
      form.reset(loadedData);
    }
  }, [loadedData]);

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
        if (match) nextNumber = parseInt(match[0]) + 1;
      }
      form.setValue("invoice_number", `INV-${String(nextNumber).padStart(5, "0")}`);
    } catch (e) {
      console.error("Error generating invoice number:", e);
    }
  };

  const onSubmit = async (data: InvoiceFormData, sendInvoice: boolean = false) => {
    setIsLoading(true);
    try {
      const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const tax_amount = data.items.reduce((s, i) => s + i.quantity * i.unit_price * (i.tax_rate / 100), 0);
      const total_amount = subtotal + tax_amount;

      const customerName = customers.find((c) => c.id === data.customer_id)?.name;
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
        category: (data as any).category || customerName || null,
      };

      let invoiceId: string;

      if (isEdit && id) {
        const { error } = await supabase.from("invoices").update(invoiceData).eq("id", id);
        if (error) throw error;
        invoiceId = id;
        await supabase.from("invoice_items").delete().eq("invoice_id", id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");
        const { data: newInv, error } = await supabase
          .from("invoices")
          .insert([{ ...invoiceData, user_id: user.id, amount_paid: 0 }])
          .select()
          .single();
        if (error) throw error;
        invoiceId = newInv.id;

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

      const lineItems = data.items.map((item) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        account_id: item.account_id || null,
      }));
      const { error: itemsError } = await supabase.from("invoice_items").insert(lineItems);
      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: isEdit ? "Invoice updated successfully" : sendInvoice ? "Invoice sent successfully" : "Invoice saved as draft",
      });
      navigate("/invoices");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save invoice", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{isEdit ? "Edit Invoice" : "Create Invoice"}</h1>
              <p className="text-sm text-muted-foreground">
                {isEdit ? "Update invoice details and line items" : "Fill in details and add line items"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/invoices")} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="outline" onClick={form.handleSubmit((d) => onSubmit(d, false))} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save as Draft"}
            </Button>
            <Button onClick={form.handleSubmit((d) => onSubmit(d, true))} disabled={isLoading}>
              {isLoading ? "Sending..." : isEdit ? "Update Invoice" : "Send Invoice"}
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <h3 className="text-lg font-semibold">Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            {customers.length === 0 ? (
                              <SelectItem value="none" disabled>No customers found</SelectItem>
                            ) : (
                              customers.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}{c.email && ` (${c.email})`}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="invoice_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Invoice Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="p-3 pointer-events-auto" />
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
                              <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < form.watch("invoice_date")} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                            <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                            <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                            <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                            <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                            <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                            <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <h3 className="text-lg font-semibold">Line Items</h3>
                <LineItemsEditor form={form} />

                <Separator />

                <h3 className="text-lg font-semibold">Notes & Terms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Payment due within 30 days..." className="resize-none" rows={4} {...field} />
                        </FormControl>
                        <FormDescription>Specify payment terms and conditions</FormDescription>
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
                          <Textarea placeholder="Additional notes or comments..." className="resize-none" rows={4} {...field} />
                        </FormControl>
                        <FormDescription>Internal notes or customer-facing comments</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bottom action bar */}
            <div className="flex justify-end gap-2 pb-6">
              <Button type="button" variant="outline" onClick={() => navigate("/invoices")} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={form.handleSubmit((d) => onSubmit(d, false))} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save as Draft"}
              </Button>
              <Button type="button" onClick={form.handleSubmit((d) => onSubmit(d, true))} disabled={isLoading}>
                {isLoading ? "Sending..." : isEdit ? "Update Invoice" : "Send Invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
