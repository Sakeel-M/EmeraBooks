import { supabase } from "@/integrations/supabase/client";

// Helper to get current authenticated user ID
const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");
  return user.id;
};

export interface UploadedFile {
  id: string;
  created_at: string;
  file_name: string;
  bank_name: string;
  currency: string;
  country: string | null;
  bank_code: string | null;
  total_transactions: number;
}

export interface Transaction {
  id: string;
  file_id: string;
  transaction_date: string;
  description: string;
  category: string;
  amount: number;
  created_at: string;
}

export interface AnalysisResult {
  id: string;
  file_id: string;
  ai_analysis: any;
  basic_statistics: any;
  data_overview: any;
  created_at: string;
}

export interface Budget {
  id: string;
  category: string;
  budget_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  preferred_currency: string;
  theme: string;
  created_at: string;
  updated_at: string;
}

export const database = {
  // File operations
  async saveUploadedFile(fileData: {
    file_name: string;
    bank_name: string;
    currency: string;
    country?: string;
    bank_code?: string;
    total_transactions: number;
  }): Promise<UploadedFile | null> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("uploaded_files")
      .insert({ ...fileData, user_id: userId })
      .select()
      .single();

    if (error) {
      console.error("Error saving file:", error);
      throw error;
    }

    return data;
  },

  async getAllFiles(): Promise<UploadedFile[]> {
    const { data, error } = await supabase
      .from("uploaded_files")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching files:", error);
      return [];
    }

    return data || [];
  },

  async getFileById(id: string): Promise<UploadedFile | null> {
    const { data, error } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching file:", error);
      return null;
    }

    return data;
  },

  async deleteFile(id: string): Promise<boolean> {
    // Fail fast if not logged in
    const userId = await getCurrentUserId(); // throws if not authenticated
    console.log(`🗑️ Starting cascade delete for file: ${id} (user: ${userId})`);

    // 1. Fetch the file metadata for legacy backfill
    const { data: fileData, error: fileError } = await supabase
      .from("uploaded_files")
      .select("created_at")
      .eq("id", id)
      .single();

    if (fileError || !fileData) {
      throw new Error("Report not found or you don't have permission to delete it.");
    }

    // 2. Legacy backfill: tag old auto-created bills/invoices with source_file_id
    //    so the FK CASCADE will clean them up when we delete the report
    const fileCreatedAt = new Date(fileData.created_at);
    const startTime = new Date(fileCreatedAt.getTime() - 10_000).toISOString();

    // Cap the window at the next newer file's created_at (or +24h)
    const { data: nextFile } = await supabase
      .from("uploaded_files")
      .select("created_at")
      .gt("created_at", fileData.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const maxEnd = new Date(fileCreatedAt.getTime() + 24 * 60 * 60 * 1000);
    const endTime = nextFile
      ? new Date(Math.min(new Date(nextFile.created_at).getTime() - 1000, maxEnd.getTime())).toISOString()
      : maxEnd.toISOString();

    // Backfill bills
    const { error: backfillBillsErr } = await supabase
      .from("bills")
      .update({ source_file_id: id })
      .is("source_file_id", null)
      .ilike("bill_number", "BILL-%")
      .gte("created_at", startTime)
      .lte("created_at", endTime);

    if (backfillBillsErr) console.warn("Backfill bills warning:", backfillBillsErr.message);

    // Backfill invoices
    const { error: backfillInvErr } = await supabase
      .from("invoices")
      .update({ source_file_id: id })
      .is("source_file_id", null)
      .ilike("invoice_number", "INV-%")
      .gte("created_at", startTime)
      .lte("created_at", endTime);

    if (backfillInvErr) console.warn("Backfill invoices warning:", backfillInvErr.message);

    // 3. Delete the uploaded_files row — CASCADE will handle:
    //    transactions, analysis_results, bills (+ bill_items), invoices (+ invoice_items)
    const { error: deleteError } = await supabase
      .from("uploaded_files")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new Error(`Failed to delete report: ${deleteError.message}`);
    }

    // 4. Check if user has any remaining files
    const { count: remainingFiles } = await supabase
      .from("uploaded_files")
      .select("id", { count: "exact", head: true });

    if (remainingFiles === 0) {
      // No files left — purge ALL auto-created data
      await this.purgeAllAutoCreatedData();
    } else {
      // Still have files — delete orphaned records
      await this.deleteOrphanedAutoRecords();
    }

    console.log(`✅ Cascade delete complete for file: ${id}`);
    return true;
  },

  // Purge all auto-created records (bills, invoices, vendors, customers)
  async purgeAllAutoCreatedData(): Promise<void> {
    console.log("🧹 Purging all auto-created data (no files remain)...");

    // Bulk delete — bill_items/invoice_items cascade automatically from parent FK
    await supabase.from("bills").delete().ilike("bill_number", "BILL-%");
    await supabase.from("invoices").delete().ilike("invoice_number", "INV-%");
    await supabase.from("vendors").delete().eq("notes", "Auto-created from bank statement");
    await supabase.from("customers").delete().eq("notes", "Auto-created from bank statement");
    await supabase.from("payables_receivables").delete().eq("source", "auto");

    // Clear localStorage ghost data
    localStorage.removeItem("currentFileId");
    localStorage.removeItem("finance_current_file");
    localStorage.removeItem("finance_uploaded_files");

    console.log("✅ Purge complete");
  },

  // Delete orphaned auto-created bills/invoices with NULL source_file_id
  async deleteOrphanedAutoRecords(): Promise<void> {
    console.log("🧹 Cleaning orphaned auto-created records with NULL source_file_id...");

    // Bulk delete orphaned bills/invoices (cascade handles items)
    await supabase.from("bills").delete().ilike("bill_number", "BILL-%").is("source_file_id", null);
    await supabase.from("invoices").delete().ilike("invoice_number", "INV-%").is("source_file_id", null);

    // Delete auto-vendors/customers that have zero remaining bills/invoices
    // Since we just deleted orphan bills/invoices, any auto-vendor with 0 bills is orphaned
    const { data: autoVendors } = await supabase
      .from("vendors")
      .select("id")
      .eq("notes", "Auto-created from bank statement");

    if (autoVendors && autoVendors.length > 0) {
      for (const vendor of autoVendors) {
        const { count } = await supabase
          .from("bills")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", vendor.id);
        if (count === 0) {
          await supabase.from("vendors").delete().eq("id", vendor.id);
        }
      }
    }

    const { data: autoCustomers } = await supabase
      .from("customers")
      .select("id")
      .eq("notes", "Auto-created from bank statement");

    if (autoCustomers && autoCustomers.length > 0) {
      for (const customer of autoCustomers) {
        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customer.id);
        if (count === 0) {
          await supabase.from("customers").delete().eq("id", customer.id);
        }
      }
    }

    console.log("✅ Orphan cleanup complete");
  },

  // Standalone cleanup callable from Index page on startup
  async cleanupOrphanedData(): Promise<void> {
    try {
      await getCurrentUserId();
    } catch {
      return; // Not authenticated, skip
    }

    const { count } = await supabase
      .from("uploaded_files")
      .select("id", { count: "exact", head: true });

    if (count === 0) {
      await this.purgeAllAutoCreatedData();
    } else {
      await this.deleteOrphanedAutoRecords();
    }
  },

  // Transaction operations
  async saveTransactions(fileId: string, transactions: any[]): Promise<boolean> {
    const userId = await getCurrentUserId();
    const transactionData = transactions.map((t) => {
      // Parse date to ensure it's in correct format (YYYY-MM-DD)
      let dateStr = t.Date || t.date || t.transaction_date;
      
      // Convert to ISO date format if needed
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        }
      }

      return {
        file_id: fileId,
        user_id: userId,
        transaction_date: dateStr,
        description: t.Description || t.description || "",
        category: t.Category || t.category || "Uncategorized",
        amount: parseFloat(t.Amount || t.amount || 0),
      };
    });

    console.log(`💾 Inserting ${transactionData.length} transactions...`);

    const { error } = await supabase
      .from("transactions")
      .insert(transactionData);

    if (error) {
      console.error("❌ Error saving transactions:", error);
      throw error;
    }

    console.log("✅ Successfully saved transactions");
    return true;
  },

  async getTransactionsByFileId(fileId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("file_id", fileId)
      .order("transaction_date", { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }

    return data || [];
  },

  // Analysis operations
  async saveAnalysis(fileId: string, analysisData: {
    ai_analysis: any;
    basic_statistics: any;
    data_overview: any;
  }): Promise<AnalysisResult | null> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("analysis_results")
      .insert({
        file_id: fileId,
        user_id: userId,
        ...analysisData,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving analysis:", error);
      throw error;
    }

    return data;
  },

  async getAnalysisByFileId(fileId: string): Promise<AnalysisResult | null> {
    const { data, error } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("file_id", fileId)
      .single();

    if (error) {
      console.error("Error fetching analysis:", error);
      return null;
    }

    return data;
  },

  // Budget operations
  async saveBudgets(budgets: Record<string, number>, currency: string): Promise<boolean> {
    const userId = await getCurrentUserId();
    
    // Delete only THIS user's existing budgets (not all budgets)
    const { error: deleteError } = await supabase
      .from("budgets")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting existing budgets:", deleteError);
      return false;
    }

    // Insert new budgets
    const budgetData = Object.entries(budgets).map(([category, amount]) => ({
      category,
      budget_amount: amount,
      currency,
      user_id: userId,
    }));

    if (budgetData.length === 0) return true;

    const { error } = await supabase
      .from("budgets")
      .insert(budgetData);

    if (error) {
      console.error("Error saving budgets:", error);
      return false;
    }

    return true;
  },

  async getBudgets(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from("budgets")
      .select("*");

    if (error) {
      console.error("Error fetching budgets:", error);
      return {};
    }

    const budgets: Record<string, number> = {};
    data?.forEach((budget) => {
      budgets[budget.category] = budget.budget_amount;
    });

    return budgets;
  },

  // Preferences operations
  async savePreferences(prefs: {
    preferred_currency?: string;
    theme?: string;
  }): Promise<boolean> {
    const userId = await getCurrentUserId();
    // Check if preferences exist
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("*")
      .limit(1)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("user_preferences")
        .update(prefs)
        .eq("id", existing.id);

      if (error) {
        console.error("Error updating preferences:", error);
        return false;
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from("user_preferences")
        .insert({ ...prefs, user_id: userId });

      if (error) {
        console.error("Error saving preferences:", error);
        return false;
      }
    }

    return true;
  },

  async getPreferences(): Promise<UserPreferences | null> {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching preferences:", error);
      return null;
    }

    return data;
  },

  // Set current file (in localStorage for now, can be moved to DB later)
  setCurrentFile(fileId: string) {
    localStorage.setItem("currentFileId", fileId);
  },

  getCurrentFile(): string | null {
    return localStorage.getItem("currentFileId");
  },

  // Transform bank transactions into business records
  async syncBankDataToBusinessRecords(fileId: string, transactions: any[], currency: string): Promise<{
    vendorsCreated: number;
    billsCreated: number;
    customersCreated: number;
    invoicesCreated: number;
  }> {
    console.log("🔄 Starting sync of bank data to business records...");
    
    const userId = await getCurrentUserId();
    const vendorMap = new Map<string, string>(); // payee name -> vendor_id
    const customerMap = new Map<string, string>(); // payer name -> customer_id
    let vendorsCreated = 0;
    let billsCreated = 0;
    let customersCreated = 0;
    let invoicesCreated = 0;

    // Fetch existing vendors and customers to avoid duplicates
    const { data: existingVendors } = await supabase.from("vendors").select("id, name");
    const { data: existingCustomers } = await supabase.from("customers").select("id, name");

    // Build maps of existing entities
    existingVendors?.forEach(v => vendorMap.set(this.normalizeEntityName(v.name), v.id));
    existingCustomers?.forEach(c => customerMap.set(this.normalizeEntityName(c.name), c.id));

    // Process each transaction
    for (const transaction of transactions) {
      const amount = Math.abs(parseFloat(transaction.Amount || transaction.amount || 0));
      const description = transaction.Description || transaction.description || "";
      const category = transaction.Category || transaction.category || "Uncategorized";
      const transactionDate = transaction.Date || transaction.date || transaction.transaction_date;
      
      if (amount === 0) continue; // Skip zero-amount transactions

      // Determine if it's an expense or income
      const isExpense = (parseFloat(transaction.Amount || transaction.amount || 0)) < 0;

      if (isExpense) {
        // Create vendor and bill for expenses
        const payeeName = this.extractPayeeName(description);
        const normalizedName = this.normalizeEntityName(payeeName);
        
        let vendorId = vendorMap.get(normalizedName);
        
        // Create vendor if doesn't exist
        if (!vendorId) {
          const { data: newVendor } = await supabase
            .from("vendors")
            .insert({
              name: payeeName,
              user_id: userId,
              notes: "Auto-created from bank statement",
            })
            .select("id")
            .single();
          
          if (newVendor) {
            vendorId = newVendor.id;
            vendorMap.set(normalizedName, vendorId);
            vendorsCreated++;
          }
        }

        // Create bill
        if (vendorId) {
          const billNumber = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const billDate = new Date(transactionDate).toISOString().split('T')[0];
          const dueDate = new Date(new Date(transactionDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          const { error } = await supabase.from("bills").insert({
            vendor_id: vendorId,
            user_id: userId,
            bill_number: billNumber,
            bill_date: billDate,
            due_date: dueDate,
            subtotal: amount,
            tax_amount: 0,
            total_amount: amount,
            amount_paid: amount,
            status: "paid",
            currency: currency,
            notes: `${category} - ${description}`,
            source_file_id: fileId,
          });

          if (!error) billsCreated++;
        }
      } else if (amount > 0) {
        // Create customer and invoice for income
        const payerName = this.extractPayeeName(description);
        const normalizedName = this.normalizeEntityName(payerName);
        
        let customerId = customerMap.get(normalizedName);
        
        // Create customer if doesn't exist
        if (!customerId) {
          const { data: newCustomer } = await supabase
            .from("customers")
            .insert({
              name: payerName,
              user_id: userId,
              notes: "Auto-created from bank statement",
            })
            .select("id")
            .single();
          
          if (newCustomer) {
            customerId = newCustomer.id;
            customerMap.set(normalizedName, customerId);
            customersCreated++;
          }
        }

        // Create invoice
        if (customerId) {
          const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const invoiceDate = new Date(transactionDate).toISOString().split('T')[0];
          const dueDate = new Date(new Date(transactionDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          const { error } = await supabase.from("invoices").insert({
            customer_id: customerId,
            user_id: userId,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            subtotal: amount,
            tax_amount: 0,
            total_amount: amount,
            amount_paid: amount,
            status: "paid",
            currency: currency,
            notes: `${category} - ${description}`,
            source_file_id: fileId,
          });

          if (!error) invoicesCreated++;
        }
      }
    }

    console.log(`✅ Sync complete: ${vendorsCreated} vendors, ${billsCreated} bills, ${customersCreated} customers, ${invoicesCreated} invoices`);
    
    return { vendorsCreated, billsCreated, customersCreated, invoicesCreated };
  },

  // Helper: Extract payee/payer name from transaction description
  extractPayeeName(description: string): string {
    if (!description) return "Unknown";
    
    // Remove common prefixes and clean up
    let cleaned = description
      .replace(/^(POS|ATM|ACH|WIRE|CHECK|DEBIT|CREDIT)\s+/i, "")
      .replace(/\s+\d{4,}$/, "") // Remove trailing numbers
      .replace(/\s+#\d+$/, "") // Remove reference numbers
      .trim();
    
    // Take first part if there's a dash or pipe
    if (cleaned.includes(" - ")) {
      cleaned = cleaned.split(" - ")[0];
    }
    if (cleaned.includes(" | ")) {
      cleaned = cleaned.split(" | ")[0];
    }
    
    // Capitalize properly
    cleaned = cleaned.split(" ").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(" ");
    
    return cleaned || "Unknown";
  },

  // Helper: Normalize entity names for comparison
  normalizeEntityName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  },
};
