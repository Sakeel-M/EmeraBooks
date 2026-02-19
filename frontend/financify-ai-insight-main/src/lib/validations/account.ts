import { z } from "zod";

export const accountSchema = z.object({
  account_name: z.string().min(1, "Account name is required"),
  account_number: z.string().min(1, "Account number is required"),
  account_type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  description: z.string().optional(),
  parent_account_id: z.string().uuid().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type AccountFormData = z.infer<typeof accountSchema>;
