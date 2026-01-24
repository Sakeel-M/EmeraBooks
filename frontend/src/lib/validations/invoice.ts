import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string()
    .trim()
    .min(1, "Description is required")
    .max(255, "Description must be less than 255 characters"),
  quantity: z.number()
    .min(0.01, "Quantity must be greater than 0")
    .max(999999, "Quantity is too large"),
  unit_price: z.number()
    .min(0, "Price must be positive")
    .max(999999999, "Price is too large"),
  tax_rate: z.number()
    .min(0, "Tax rate must be positive")
    .max(100, "Tax rate cannot exceed 100%"),
  account_id: z.string().optional().nullable(),
});

export const invoiceSchema = z.object({
  customer_id: z.string()
    .min(1, "Customer is required")
    .uuid("Invalid customer"),
  invoice_number: z.string()
    .trim()
    .min(1, "Invoice number is required")
    .max(50, "Invoice number must be less than 50 characters"),
  invoice_date: z.date({
    required_error: "Invoice date is required",
  }),
  due_date: z.date({
    required_error: "Due date is required",
  }),
  currency: z.string()
    .min(3, "Currency is required")
    .max(3, "Currency must be 3 characters"),
  terms: z.string()
    .trim()
    .max(500, "Terms must be less than 500 characters")
    .optional()
    .or(z.literal("")),
  notes: z.string()
    .trim()
    .max(1000, "Notes must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  items: z.array(invoiceItemSchema)
    .min(1, "Add at least one line item")
    .max(100, "Maximum 100 line items allowed"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"])
    .default("draft"),
}).refine((data) => data.due_date >= data.invoice_date, {
  message: "Due date must be on or after invoice date",
  path: ["due_date"],
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>;
