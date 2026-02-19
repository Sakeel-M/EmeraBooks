import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { PayableReceivable } from "@/lib/payables";

const formSchema = z.object({
  type: z.enum(["payable", "receivable"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string().default("USD"),
  due_date: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["pending", "partial", "settled"]).default("pending"),
});

type FormData = z.infer<typeof formSchema>;

interface PayableFormProps {
  editItem?: PayableReceivable;
  defaultType?: "payable" | "receivable";
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PayableForm({ 
  editItem, 
  defaultType = "payable", 
  trigger, 
  onSuccess,
  open: controlledOpen,
  onOpenChange 
}: PayableFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const queryClient = useQueryClient();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: defaultType,
      title: "",
      description: "",
      amount: 0,
      currency: "USD",
      due_date: "",
      category: "",
      status: "pending",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        type: editItem?.type || defaultType,
        title: editItem?.title || "",
        description: editItem?.description || "",
        amount: editItem?.amount || 0,
        currency: editItem?.currency || "USD",
        due_date: editItem?.due_date || "",
        category: editItem?.category || "",
        status: (editItem?.status as "pending" | "partial" | "settled") || "pending",
      });
    }
  }, [open, editItem, form, defaultType]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const payload = {
        type: data.type,
        title: data.title,
        description: data.description || null,
        amount: data.amount,
        currency: data.currency,
        due_date: data.due_date || null,
        category: data.category || null,
        status: data.status,
        user_id: user.user.id,
        source: "manual",
      };

      if (editItem) {
        const { error } = await supabase
          .from("payables_receivables")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payables_receivables")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editItem ? "Item updated successfully" : "Item created successfully");
      queryClient.invalidateQueries({ queryKey: ["payables-receivables"] });
      setOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save item");
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const typeLabel = form.watch("type") === "payable" ? "Payable" : "Receivable";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editItem ? `Edit ${typeLabel}` : `Add New ${typeLabel}`}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="payable">Amount Payable</SelectItem>
                      <SelectItem value="receivable">Amount Receivable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Electricity Bill, Customer Invoice" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional details..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
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
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Utility">Utility</SelectItem>
                        <SelectItem value="Telecom">Telecom</SelectItem>
                        <SelectItem value="Rent">Rent</SelectItem>
                        <SelectItem value="Insurance">Insurance</SelectItem>
                        <SelectItem value="Subscription">Subscription</SelectItem>
                        <SelectItem value="Vendor">Vendor</SelectItem>
                        <SelectItem value="Customer">Customer</SelectItem>
                        <SelectItem value="Services">Services</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partially Paid</SelectItem>
                      <SelectItem value="settled">Settled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : editItem ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
