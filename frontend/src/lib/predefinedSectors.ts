export interface PredefinedSector {
  name: string;
  key: string;
}

// Canonical sector names — match sectorMapping.ts SECTOR_KEYWORDS exactly.
// Used in dropdowns for manual categorization (vendor, bill, budget, etc.)
// Having a single consistent list ensures budget category matching works correctly.
export const PREDEFINED_SECTORS: PredefinedSector[] = [
  // --- Income categories ---
  { name: "Salary & Income", key: "salary" },
  { name: "Business Income", key: "business_income" },
  { name: "ATM & Cash Deposits", key: "atm_deposits" },

  // --- Expense categories ---
  { name: "Food & Beverage", key: "food" },
  { name: "Transportation & Logistics", key: "transportation" },
  { name: "Retail & Shopping", key: "shopping" },
  { name: "Healthcare", key: "health" },
  { name: "Utilities", key: "utilities" },
  { name: "Entertainment & Media", key: "entertainment" },
  { name: "Technology", key: "technology" },
  { name: "Finance & Banking", key: "finance" },
  { name: "Travel & Tourism", key: "travel" },

  // --- Business / industry sectors ---
  { name: "Real Estate", key: "housing" },
  { name: "Professional Services", key: "professional" },
  { name: "Marketing & Advertising", key: "marketing" },
  { name: "Manufacturing", key: "manufacturing" },
  { name: "Education", key: "education" },
  { name: "Construction", key: "construction" },
  { name: "Agriculture", key: "agriculture" },
  { name: "Legal Services", key: "legal" },

  // --- Transfer / catch-all ---
  { name: "Internal Transfer", key: "internal" },
  { name: "Other", key: "other" },
];
