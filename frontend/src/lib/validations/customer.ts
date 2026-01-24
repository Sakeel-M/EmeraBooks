import { z } from "zod";

export const customerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  phone: z.string()
    .trim()
    .max(20, "Phone must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  address: z.string()
    .trim()
    .max(255, "Address must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  city: z.string()
    .trim()
    .max(100, "City must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  state: z.string()
    .trim()
    .max(100, "State must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  zip_code: z.string()
    .trim()
    .max(20, "ZIP code must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  country: z.string()
    .trim()
    .max(100, "Country must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  notes: z.string()
    .trim()
    .max(1000, "Notes must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
