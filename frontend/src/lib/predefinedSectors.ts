export interface PredefinedSector {
  name: string;
  key: string;
}

export const PREDEFINED_SECTORS: PredefinedSector[] = [
  // --- Bank-statement categories (exact names the backend writes) ---
  { name: "Internal Transfer", key: "internal" },
  { name: "Salary & Income", key: "salary" },
  { name: "Food & Dining", key: "food" },
  { name: "Transportation", key: "transportation" },
  { name: "Shopping & Retail", key: "shopping" },
  { name: "Healthcare", key: "health" },
  { name: "Utilities & Bills", key: "utilities" },
  { name: "Entertainment", key: "entertainment" },
  { name: "Subscriptions & Digital Services", key: "technology" },
  { name: "ATM & Cash Withdrawals", key: "banking" },
  { name: "Banking & Finance", key: "finance" },
  { name: "Personal Care", key: "fitness" },
  { name: "Travel", key: "travel" },
  { name: "Other Expenses", key: "other" },

  // --- Business / industry sectors ---
  { name: "Finance & Banking", key: "banking2" },
  { name: "Marketing & Advertising", key: "marketing" },
  { name: "Food & Beverage", key: "food2" },
  { name: "Retail & Shopping", key: "shopping2" },
  { name: "Manufacturing", key: "manufacturing" },
  { name: "Transportation & Logistics", key: "transportation2" },
  { name: "Education", key: "education" },
  { name: "Real Estate", key: "housing" },
  { name: "Entertainment & Media", key: "entertainment2" },
  { name: "Utilities", key: "utilities2" },
  { name: "Professional Services", key: "professional" },
  { name: "Construction", key: "maintenance" },
  { name: "Agriculture", key: "environment" },
  { name: "Travel & Tourism", key: "travel2" },
  { name: "Healthcare & Pharma", key: "medical" },
  { name: "Clothing & Fashion", key: "clothing" },
  { name: "Sports & Fitness", key: "fitness2" },
  { name: "Legal Services", key: "legal" },
];
