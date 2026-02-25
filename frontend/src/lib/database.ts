import { supabase } from "@/integrations/supabase/client";
import { mapRawBankCategory, resolveCategory, resolveIncomeCategory, guessCategory, getCanonicalCategory } from "@/lib/sectorMapping";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("user_id", user.id)
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

    // Delete any existing transactions for this file first.
    // Prevents row accumulation if the same file slips through the duplicate check.
    await supabase.from("transactions").delete().eq("file_id", fileId).eq("user_id", userId);

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

      const rawCat = t.Category || t.category || "Uncategorized";
      const desc = t.Description || t.description || "";
      return {
        file_id: fileId,
        user_id: userId,
        transaction_date: dateStr,
        description: desc,
        category: getCanonicalCategory(rawCat, null, desc),
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

    // Check if an analysis already exists for this file
    const { data: existing } = await supabase
      .from("analysis_results")
      .select("id")
      .eq("file_id", fileId)
      .maybeSingle();

    let data, error;

    if (existing) {
      // Update existing row (re-analysis case)
      ({ data, error } = await supabase
        .from("analysis_results")
        .update({ ...analysisData, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single());
    } else {
      // Insert new row
      ({ data, error } = await supabase
        .from("analysis_results")
        .insert({ file_id: fileId, user_id: userId, ...analysisData })
        .select()
        .single());
    }

    if (error) {
      console.error("Error saving analysis:", error);
      throw error;
    }

    return data;
  },

  async getAnalysisByFileId(fileId: string): Promise<AnalysisResult | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("file_id", fileId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error fetching analysis:", error);
      return null;
    }

    return data;
  },

  // Budget operations
  async saveBudgets(budgets: Record<string, number>, currency: string): Promise<void> {
    const userId = await getCurrentUserId();

    // Delete only THIS user's existing budgets
    const { error: deleteError } = await supabase
      .from("budgets")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting existing budgets:", deleteError);
      throw new Error(deleteError.message);
    }

    // Insert new budgets (skip zero-amount entries)
    const budgetData = Object.entries(budgets)
      .filter(([, amount]) => amount > 0)
      .map(([category, amount]) => ({
        category,
        budget_amount: amount,
        currency,
        user_id: userId,
      }));

    if (budgetData.length === 0) return;

    const { error } = await supabase
      .from("budgets")
      .insert(budgetData);

    if (error) {
      console.error("Error saving budgets:", error);
      throw new Error(error.message);
    }
  },

  async getBudgets(): Promise<Record<string, number>> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId);

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

  // Transform bank transactions into business records (batch inserts for performance)
  async syncBankDataToBusinessRecords(fileId: string, transactions: any[], currency: string): Promise<{
    vendorsCreated: number;
    billsCreated: number;
    customersCreated: number;
    invoicesCreated: number;
  }> {
    console.log("🔄 Starting sync of bank data to business records...");

    // Always delete existing invoices so they are recreated with latest logic (5% VAT, all income)
    await supabase.from("invoices").delete().eq("source_file_id", fileId);

    // Only check bills to prevent duplicate expense records
    const billsCheck = await supabase.from("bills").select("id", { count: "exact", head: true }).eq("source_file_id", fileId);
    const billsAlreadyExist = (billsCheck.count ?? 0) > 0;
    if (billsAlreadyExist) {
      console.log("ℹ️ Bills already exist for this file — refreshing invoices only.");
    }

    const userId = await getCurrentUserId();

    // Categories that represent non-business events — should not generate bills/invoices
    const NON_BUSINESS = new Set([
      "internal transfer", "atm & cash withdrawals", "atm & cash deposits",
      "atm", "atm withdrawal", "cash withdrawal", "cash advance",
      "bank transfer", "wire transfer", "inter-account transfer",
    ]);

    // ── PASS 1: Classify transactions and collect unique vendor/customer names ──
    type EnrichedTxn = { _category: string; _rawName: string; _normName: string; _amount: number; [k: string]: any };
    const expenseTxns: EnrichedTxn[] = [];
    const incomeTxns: EnrichedTxn[] = [];
    const vendorNameMap = new Map<string, string>(); // normalized → rawName (first occurrence)
    const customerNameMap = new Map<string, string>();

    for (const t of transactions) {
      const rawAmt = parseFloat(t.Amount || t.amount || 0);
      if (Math.abs(rawAmt) === 0) continue;
      const rawCat = (t.Category || t.category || "Uncategorized");
      const description = t.Description || t.description || "";
      // Income uses income-specific categorization (prevents food/tech/retail on invoices)
      // Expenses: name-first canonical resolver (guessCategory(name) wins over stored category)
      const rawName = this.extractPayeeName(t.MerchantName || t.merchantName || description);
      const category = rawAmt >= 0
        ? resolveIncomeCategory(rawCat, description)
        : getCanonicalCategory(rawCat, rawName, description);
      // Skip non-business expense categories (ATM withdrawals, internal transfers, etc.)
      if (rawAmt < 0 && (NON_BUSINESS.has(rawCat.toLowerCase().trim()) || NON_BUSINESS.has(category.toLowerCase()))) continue;
      // Skip income that is clearly own-account movement — these are NOT customer payments
      if (rawAmt >= 0 && (category.toLowerCase() === "internal transfer" || category.toLowerCase() === "atm & cash deposits")) continue;

      const normName = this.normalizeEntityName(rawName);
      const enriched: EnrichedTxn = { ...t, _category: category, _rawName: rawName, _normName: normName, _amount: Math.abs(rawAmt) };

      if (rawAmt < 0) {
        expenseTxns.push(enriched);
        if (!vendorNameMap.has(normName)) vendorNameMap.set(normName, rawName);
      } else {
        incomeTxns.push(enriched);
        if (!customerNameMap.has(normName)) customerNameMap.set(normName, rawName);
      }
    }

    // ── PASS 2: Fetch existing vendors/customers in parallel ──
    const [vendorsRes, customersRes] = await Promise.all([
      supabase.from("vendors").select("id, name").eq("user_id", userId),
      supabase.from("customers").select("id, name").eq("user_id", userId),
    ]);
    const vendorMap = new Map<string, string>();
    const customerMap = new Map<string, string>();
    vendorsRes.data?.forEach(v => vendorMap.set(this.normalizeEntityName(v.name), v.id));
    customersRes.data?.forEach(c => customerMap.set(this.normalizeEntityName(c.name), c.id));

    // ── PASS 3: Batch-create new vendors (skip if bills already exist) ──
    const newVendors = Array.from(vendorNameMap.entries())
      .filter(([norm]) => !vendorMap.has(norm))
      .map(([, rawName]) => ({ name: rawName, user_id: userId, notes: "Auto-created from bank statement" }));

    let vendorsCreated = 0;
    if (newVendors.length > 0 && !billsAlreadyExist) {
      const { data: created } = await supabase.from("vendors").insert(newVendors).select("id, name");
      created?.forEach(v => { vendorMap.set(this.normalizeEntityName(v.name), v.id); vendorsCreated++; });
    }

    // ── PASS 4: Batch-create new customers ──
    const newCustomers = Array.from(customerNameMap.entries())
      .filter(([norm]) => !customerMap.has(norm))
      .map(([, rawName]) => ({ name: rawName, user_id: userId, notes: "Auto-created from bank statement" }));

    let customersCreated = 0;
    if (newCustomers.length > 0) {
      const { data: created } = await supabase.from("customers").insert(newCustomers).select("id, name");
      created?.forEach(c => { customerMap.set(this.normalizeEntityName(c.name), c.id); customersCreated++; });
    }

    // ── PASS 5: Build and batch-insert bills (skip if bills already exist) ──
    let billsCreated = 0;
    if (!billsAlreadyExist) {
      const billsToInsert = expenseTxns
        .map((t, idx) => {
          const vendorId = vendorMap.get(t._normName);
          if (!vendorId) return null;
          const transactionDate = t.Date || t.date || t.transaction_date;
          const billDate = new Date(transactionDate).toISOString().split('T')[0];
          const dueDate = new Date(new Date(transactionDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          return {
            vendor_id: vendorId,
            user_id: userId,
            bill_number: `BILL-${fileId.slice(0, 8)}-${String(idx).padStart(6, '0')}`,
            bill_date: billDate,
            due_date: dueDate,
            subtotal: t._amount,
            tax_amount: 0,
            total_amount: t._amount,
            amount_paid: t._amount,
            status: "paid",
            currency,
            category: t._category,
            notes: `${t._category} - ${t.Description || t.description || ""}`,
            source_file_id: fileId,
          };
        })
        .filter(Boolean);

      for (let i = 0; i < billsToInsert.length; i += 500) {
        const { error } = await supabase.from("bills").insert(billsToInsert.slice(i, i + 500) as any[]);
        if (!error) billsCreated += Math.min(500, billsToInsert.length - i);
        else console.error("❌ Bills batch insert error:", error.message);
      }
    }

    // ── PASS 6: Build and batch-insert invoices ──
    const invoicesToInsert = incomeTxns
      .map((t, idx) => {
        const customerId = customerMap.get(t._normName);
        if (!customerId) return null;
        const transactionDate = t.Date || t.date || t.transaction_date;
        const invoiceDate = new Date(transactionDate).toISOString().split('T')[0];
        const dueDate = new Date(new Date(transactionDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return {
          customer_id: customerId,
          user_id: userId,
          invoice_number: `INV-${fileId.slice(0, 8)}-${String(idx).padStart(6, '0')}`,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal: +(t._amount * 0.95).toFixed(2),   // tax-inclusive: original = subtotal + tax
          tax_amount: +(t._amount * 0.05).toFixed(2),
          total_amount: t._amount,                       // total stays = original amount received
          amount_paid: t._amount,
          status: "paid",
          currency,
          category: t._category,
          notes: `${t._category} - ${t.Description || t.description || ""}`,
          source_file_id: fileId,
        };
      })
      .filter(Boolean);

    let invoicesCreated = 0;
    for (let i = 0; i < invoicesToInsert.length; i += 500) {
      const { error } = await supabase.from("invoices").insert(invoicesToInsert.slice(i, i + 500) as any[]);
      if (!error) invoicesCreated += Math.min(500, invoicesToInsert.length - i);
      else console.error("❌ Invoices batch insert error:", error.message);
    }

    console.log(`✅ Sync complete: ${vendorsCreated} vendors, ${billsCreated} bills, ${customersCreated} customers, ${invoicesCreated} invoices`);

    // ── PASS 7: Batch journal entries (non-critical — skip if bills already exist to avoid duplicates) ──
    try {
      if (billsAlreadyExist) throw new Error("skip"); // bills/journal entries already created
      const journalTxns = [...expenseTxns, ...incomeTxns];
      if (journalTxns.length > 0) {
        const jeData = journalTxns.map((t, idx) => ({
          user_id: userId,
          entry_date: (t.Date || t.date || t.transaction_date || new Date().toISOString()).split("T")[0],
          description: t._rawName,
          reference: `BANK-AUTO-${fileId.slice(0, 8)}`,
          entry_number: `JE-${fileId.slice(0, 8)}-${String(idx).padStart(6, '0')}`,
        }));

        // Insert journal entries in chunks, collect IDs
        const allCreatedEntries: Array<{ id: string }> = [];
        for (let i = 0; i < jeData.length; i += 500) {
          const { data } = await supabase.from("journal_entries").insert(jeData.slice(i, i + 500)).select("id");
          if (data) allCreatedEntries.push(...data);
        }

        // Build and batch-insert journal lines
        const allLines = journalTxns.flatMap((t, idx) => {
          const entry = allCreatedEntries[idx];
          if (!entry) return [];
          const isExpense = parseFloat(t.Amount || t.amount || 0) < 0;
          return isExpense
            ? [
                { journal_entry_id: entry.id, user_id: userId, account_name: t._category, debit_amount: t._amount, credit_amount: 0 },
                { journal_entry_id: entry.id, user_id: userId, account_name: "Bank/Cash", debit_amount: 0, credit_amount: t._amount },
              ]
            : [
                { journal_entry_id: entry.id, user_id: userId, account_name: "Bank/Cash", debit_amount: t._amount, credit_amount: 0 },
                { journal_entry_id: entry.id, user_id: userId, account_name: t._category, debit_amount: 0, credit_amount: t._amount },
              ];
        });

        for (let i = 0; i < allLines.length; i += 500) {
          await supabase.from("journal_entry_lines").insert(allLines.slice(i, i + 500));
        }
        console.log(`✅ Auto journal entries created for ${journalTxns.length} transactions`);
      }
    } catch (jeError) {
      console.warn("⚠️ Auto journal entry creation failed (non-critical):", jeError);
    }

    return { vendorsCreated, billsCreated, customersCreated, invoicesCreated };
  },

  /**
   * Re-resolve categories for all existing transactions, bills, and invoices
   * using description/vendor/customer name as fallback. Fixes data saved before
   * the resolveCategory(rawCat, description) fix was applied.
   * Safe to call multiple times — only updates records where resolution improves the value.
   */
  async reCategorizeExistingData(): Promise<void> {
    const userId = await getCurrentUserId();
    console.log("🔄 Re-categorizing existing data...");

    // 1. Transactions
    const { data: txns } = await supabase
      .from("transactions").select("id, category, description").eq("user_id", userId);
    if (txns && txns.length > 0) {
      const updates = txns
        .map(t => ({ id: t.id, user_id: userId, category: getCanonicalCategory(t.category, null, t.description) }))
        .filter(u => u.category && u.category !== "Other" && u.category !== (txns.find(t => t.id === u.id)?.category));
      for (let i = 0; i < updates.length; i += 500) {
        await supabase.from("transactions").upsert(updates.slice(i, i + 500));
      }
      console.log(`✅ Re-categorized ${updates.length} transactions`);
    }

    // 2. Bills — vendor name is the most reliable signal; override stored "Technology"/"Other" etc.
    const { data: bills } = await supabase
      .from("bills").select("id, category, notes, vendors(name)").eq("user_id", userId);
    if (bills && bills.length > 0) {
      const updates = (bills as any[])
        .map(b => {
          // Use getCanonicalCategory: vendor name first → description → stored category
          const vendorName = (b as any).vendors?.name;
          const noteDesc = b.notes?.split(" - ").slice(1).join(" - ").trim() || "";
          const resolved = getCanonicalCategory(b.category, vendorName, noteDesc);
          return { id: b.id, user_id: userId, category: resolved };
        })
        .filter(u => u.category && u.category !== "Other" && u.category !== (bills as any[]).find((b: any) => b.id === u.id)?.category);
      for (let i = 0; i < updates.length; i += 500) {
        await supabase.from("bills").upsert(updates.slice(i, i + 500));
      }
      console.log(`✅ Re-categorized ${updates.length} bills`);
    }

    // 3. Invoices — customer name as primary signal
    const { data: invoices } = await supabase
      .from("invoices").select("id, category, notes, customers(name)").eq("user_id", userId);
    if (invoices && invoices.length > 0) {
      const updates = (invoices as any[])
        .map(i => {
          const customerName = (i as any).customers?.name;
          const noteDesc = i.notes?.split(" - ").slice(1).join(" - ").trim() || "";
          const resolved = resolveIncomeCategory(i.category, noteDesc || customerName);
          return { id: i.id, user_id: userId, category: resolved };
        })
        .filter(u => u.category && u.category !== "Other" && u.category !== (invoices as any[]).find((b: any) => b.id === u.id)?.category);
      for (let i = 0; i < updates.length; i += 500) {
        await supabase.from("invoices").upsert(updates.slice(i, i + 500));
      }
      console.log(`✅ Re-categorized ${updates.length} invoices`);
    }
  },

  /**
   * Wipe ALL data belonging to the current user across every table.
   * Called from Settings → "Clear All Data".
   */
  async clearAllUserData(): Promise<void> {
    const userId = await getCurrentUserId();

    // Delete uploaded files (cascades: transactions, analysis_results,
    // bills + bill_items, invoices + invoice_items via source_file_id FK)
    await supabase.from("uploaded_files").delete().eq("user_id", userId);

    // Delete auto-created vendors / customers (not covered by file cascade)
    await supabase.from("vendors").delete().eq("user_id", userId);
    await supabase.from("customers").delete().eq("user_id", userId);

    // Delete accounting data
    await supabase.from("journal_entries").delete().eq("user_id", userId);
    await supabase.from("accounts").delete().eq("user_id", userId);
    await supabase.from("bank_accounts").delete().eq("user_id", userId);
    await supabase.from("reconciliations").delete().eq("user_id", userId);
    await supabase.from("payables_receivables").delete().eq("user_id", userId);
    await supabase.from("documents").delete().eq("user_id", userId);

    // Delete user settings
    await supabase.from("budgets").delete().eq("user_id", userId);
    await supabase.from("user_preferences").delete().eq("user_id", userId);

    // Clear localStorage ghost data
    localStorage.removeItem("currentFileId");
    localStorage.removeItem("finance_current_file");
    localStorage.removeItem("finance_uploaded_files");
  },

  // Helper: Extract payee/payer name from transaction description or MerchantName
  // Pass transaction.MerchantName (backend-cleaned) when available for best results
  extractPayeeName(description: string): string {
    if (!description) return "Unknown";

    let s = description.trim();

    // UAE bank reference format: "Ln42012546429376:- Description" or "542552608:- Name"
    // Extract the part after the reference number and ":-"
    const uaeRefMatch = s.match(/^(?:[A-Za-z]{0,3})?\d{6,}:-\s*(.+)/);
    if (uaeRefMatch) s = uaeRefMatch[1].trim();

    // Strip leading 3-letter bank type code (e.g. "Com ", "Edu ", "Fam ", "Str ", "Sal ")
    s = s.replace(/^(?:Com|Edu|Fam|Str|Sal|Pur|Ref|Int|Ext|Own)\s+/i, "").trim();

    // Strip US bank transaction prefixes (with optional 4-digit date MMDD)
    const prefixPatterns = [
      /^CHECKCARD\s+\d{4}\s+/i,
      /^MOBILE\s+PURCHASE\s+\d{4}\s+/i,
      /^POS\s+PURCHASE\s+\d{4}\s+/i,
      /^RECURRING\s+PURCHASE\s+\d{4}\s+/i,
      /^ONLINE\s+PURCHASE\s+\d{4}\s+/i,
      /^DEBIT\s+CARD\s+PURCHASE\s+\d{4}\s+/i,
      /^ACH\s+DEBIT\s+/i,
      /^ACH\s+CREDIT\s+/i,
      /^WIRE\s+TRANSFER\s+(TO|FROM)\s+/i,
      /^WIRE\s+(TO|FROM)\s+/i,
      /^ZELLE\s+(TO|FROM|PAYMENT)\s+/i,
      /^VENMO\s+PAYMENT\s+/i,
      /^PAYPAL\s+(TRANSFER\s+)?/i,
      /^DIRECT\s+(DEBIT|DEPOSIT)\s+/i,
      /^ATM\s+WITHDRAWAL\s+/i,
      /^CHECKCARD\s+/i,
      /^MOBILE\s+PURCHASE\s+/i,
      /^POS\s+PURCHASE\s+/i,
      /^(POS|ATM|ACH|WIRE|CHECK|DEBIT|CREDIT)\s+/i,
    ];
    for (const p of prefixPatterns) {
      s = s.replace(p, "").trim();
      if (s !== description.trim()) break; // stop after first match
    }

    // Handle SQ * (Square payments) — extract merchant name after SQ *
    const sqMatch = s.match(/^SQ\s*\*\s*(.+)/i);
    if (sqMatch) s = sqMatch[1].trim();

    // Remove trailing US location info (City ST 12345)
    s = s.replace(/\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/, "").trim();
    s = s.replace(/\s+[A-Z]{2}$/, "").trim();

    // Remove long numeric/hex references (8+ digits)
    s = s.replace(/\s+\d{8,}/g, "").trim();
    s = s.replace(/\b[0-9A-Fa-f]{10,}\b/g, "").trim();

    // Remove RECURRING suffix and store numbers
    s = s.replace(/\s+RECURRING(\s+CHARGE)?$/i, "").trim();
    s = s.replace(/\s+#\d+.*$/i, "").trim();
    s = s.replace(/\s+\d{4,}$/, "").trim();

    // Take first segment before " - " or " | "
    if (s.includes(" - ")) s = s.split(" - ")[0].trim();
    if (s.includes(" | ")) s = s.split(" | ")[0].trim();

    // Title-case
    const result = s.replace(/\w\S*/g, (w) =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    );

    return (result || "Unknown").slice(0, 60);
  },

  // Helper: Normalize entity names for comparison
  normalizeEntityName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  },
};
