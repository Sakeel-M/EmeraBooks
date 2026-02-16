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
  category: z.string().optional(),
});

// Simplified schema for quick bill creation
export const simpleBillSchema = z.object({
  vendor_id: z.string().optional(),
  custom_vendor_name: z.string().optional(),
  bill_date: z.string().min(1, "Bill date is required"),
  due_date: z.string().min(1, "Due date is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]).default("draft"),
  category: z.string().optional(),
}).refine(
  (data) => data.vendor_id || data.custom_vendor_name,
  { message: "Please select a vendor or enter a vendor name", path: ["vendor_id"] }
);

export type BillItemFormData = z.infer<typeof billItemSchema>;
export type BillFormData = z.infer<typeof billSchema>;
export type SimpleBillFormData = z.infer<typeof simpleBillSchema>;
