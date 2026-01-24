import { z } from "zod";

export const billItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.number().min(0, "Unit price must be positive"),
  tax_rate: z.number().min(0).max(100, "Tax rate must be between 0 and 100"),
  account_id: z.string().uuid().optional(),
  amount: z.number().optional(),
});

export const billSchema = z.object({
  vendor_id: z.string().uuid("Please select a vendor"),
  bill_number: z.string().min(1, "Bill number is required"),
  bill_date: z.string().min(1, "Bill date is required"),
  due_date: z.string().min(1, "Due date is required"),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]).default("draft"),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
});

export type BillItemFormData = z.infer<typeof billItemSchema>;
export type BillFormData = z.infer<typeof billSchema>;
