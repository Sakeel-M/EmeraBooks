     FEATURE DEFINITIONS — Complete Specification

     Page 0: Onboarding (/onboarding)

     When shown: After login, if user has zero org_members records.

     0.1 Create Organization

     - Step 1 form: Organization name, country (dropdown, default AE), default currency (dropdown, default AED), VAT rate (number input,       
     default 5%), fiscal year start month (dropdown, default January)
     - On submit: INSERT into organizations + INSERT into org_members with role = 'owner'
     - Validation: Name required, slug auto-generated from name (lowercase, hyphens)

     0.2 Create First Client

     - Step 2 form: Client/company name, Trade License number (optional), TRN (optional), currency, country, industry (dropdown from
     predefined list)
     - On submit: INSERT into clients + INSERT into user_active_client
     - After completion: Redirect to / (Control Center)

     0.3 Skip / Later

     - Not allowed — at least one org + one client required before accessing the app

     ---
     Page 1: Control Center (/) — Default Landing

     Purpose: Executive overview answering "Are we financially under control?"
     Layout: Responsive grid — 2 columns on desktop, 1 on mobile. 8 cards.
     Data source: Aggregates from multiple tables for the active client.
     Auto-refresh: Every 60 seconds via React Query refetchInterval.

     1.1 Reconciliation Status Overview

     - Card type: Donut chart + stats
     - Shows: Total reconciliation sessions for active client in current period
     - Donut segments: Matched (green), Flagged (amber), Unresolved (red)
     - Stats below: Match rate % (e.g., "94.2% matched"), total sessions count, last reconciliation date
     - Query: reconciliation_sessions WHERE client_id = ? AND status IN ('in_progress','completed') → aggregate match_count, flag_count        
     - Click action: Navigate to /reconciliation
     - Empty state: "No reconciliations yet — upload a bank statement to start" with link to /integrations

     1.2 Open Mismatches

     - Card type: Count badge + scrollable list (top 5)
     - Shows: Total count of reconciliation_items WHERE status = 'flagged' AND client_id = ?
     - List items: Each shows: date, description (truncated 40 chars), amount, flag_type badge (color-coded: red for missing, amber for        
     amount mismatch, blue for timing)
     - Click on item: Navigate to /reconciliation with that session open and item highlighted
     - Click "View All": Navigate to /reconciliation filtered to flagged items
     - Empty state: Green checkmark + "No open mismatches"

     1.3 Active Risk Alerts

     - Card type: Severity breakdown with counts
     - Shows: Count of risk_alerts WHERE status = 'open' AND client_id = ? grouped by severity
     - Display: 4 rows: Critical (red dot + count), High (orange), Medium (amber), Low (blue)
     - Total alert count in card header as badge
     - Click action: Navigate to /risk
     - Empty state: Shield icon + "No active alerts — all clear"

     1.4 AR Exposure

     - Card type: Stat card with aging buckets
     - Shows: Total outstanding receivables = SUM of invoices WHERE status IN ('sent','partial','overdue') AND client_id = ?
     - Aging buckets bar: Current (green), 1-30 days (yellow), 31-60 (orange), 61-90 (red), 90+ (dark red)
     - Calculation: due_date compared to today → bucket assignment
     - Subtitle: "X invoices overdue" count
     - Click action: Navigate to /revenue → AR Monitoring tab

     1.5 Cash Position

     - Card type: Stat card with account list
     - Shows: Total balance across all bank_accounts WHERE client_id = ? AND is_active = true
     - Multi-currency handling: If all accounts same currency → single total. If mixed → show each currency total separately + warning
     badge "Multiple currencies"
     - Account list (max 3): Bank name, last 4 digits account number, balance, last_statement_date
     - "View All" link: Navigate to /cash
     - Empty state: "No bank accounts connected" with link to /integrations

     1.6 Revenue Trend

     - Card type: Line chart (last 6 months)
     - Shows: Monthly revenue (sum of positive transactions) for active client
     - X-axis: Month names (e.g., "Oct", "Nov", "Dec", "Jan", "Feb", "Mar")
     - Y-axis: Currency-formatted amounts
     - Query: transactions WHERE client_id = ? AND amount > 0 AND transaction_date >= 6 months ago → GROUP BY month
     - Tooltip: Month name + formatted amount
     - Click action: Navigate to /revenue
     - Empty state: Flat line at zero + "No revenue data yet"

     1.7 Risk Score

     - Card type: Radial gauge (0-100)
     - Score calculation (computed client-side until Flask endpoint built):
       - Reconciliation completion: weight 30% (match_rate from latest session)
       - Alert resolution: weight 20% (resolved / total alerts)
       - AR health: weight 15% (non-overdue / total AR)
       - AP health: weight 15% (non-overdue / total AP)
       - Data freshness: weight 20% (days since last sync / 30)
     - Color zones: 0-40 red, 41-60 amber, 61-80 green, 81-100 dark green
     - Label below gauge: "Low Risk" / "Medium Risk" / "High Risk" / "Critical Risk"
     - Click action: Navigate to /risk

     1.8 System Health Indicator

     - Card type: Status list with colored dots
     - Shows status of each connected integration:
       - Green dot + "Connected" + last sync time (e.g., "2 hours ago")
       - Amber dot + "Syncing" (if sync_run is 'running')
       - Red dot + "Error" + error message (truncated)
       - Gray dot + "Not connected"
     - Query: connections WHERE client_id = ? → joined with latest sync_runs
     - Also shows: Bank statement upload count, days since last upload
     - Click action: Navigate to /integrations
     - Empty state: All gray dots + "Connect your first data source"

     ---
     Page 2: Reconciliation (/reconciliation)

     Purpose: Core integrity engine — match transactions between two data sources.
     Layout: Full-width page with tab navigation at top.
     4 tabs: Bank Reconciliation | Payment Settlement | Cross-System | Matching Rules

     2.1 Bank Reconciliation Tab

     Purpose: Match bank statement transactions (Source A) against ERP/ledger entries (Source B).

     2.1.1 Session Selector

     - Top bar: Dropdown to select existing reconciliation_sessions or "New Session" button
     - New Session dialog:
       - Select bank account (dropdown from bank_accounts)
       - Select period (date range picker)
       - Select Source B type: "Manual Ledger Entries" or "ERP Data" (dropdown)
       - Statement ending balance (number input)
       - "Start Reconciliation" button → creates reconciliation_sessions row → calls POST /api/reconcile

     2.1.2 Reconciliation Summary Bar

     - Fixed bar below tabs showing session metrics:
       - Match Rate: "94.2%" (green/amber/red based on threshold)
       - Matched: "142 items" (green)
       - Flagged: "9 items" (amber)
       - Unreconciled Difference: "AED 1,234.56" (red if > 0)
       - Status badge: "In Progress" / "Completed" / "Finalized"
       - "Finalize" button (only when all flags resolved) → sets status = 'finalized', finalized_by, finalized_at

     2.1.3 Reconciliation Workbench (Split View)

     - Three-panel layout:
       - Left panel (Source A — Bank): Scrollable list of bank transactions for the session period. Each row: date, description, amount,       
     status icon (green check = matched, amber flag = flagged, gray dash = unmatched)
       - Right panel (Source B — Ledger/ERP): Same layout for ledger entries
       - Center panel (Match Results): Shows matched pairs and flagged items
     - Matched Items: Collapsed by default. Each row shows:
       - Source A: date + description + amount
       - Source B: date + description + amount
       - Match quality badge: "Exact" (green) / "Near" (blue) / "Manual" (purple)
       - Difference amount (if near match)
       - "Unmatch" button → changes status back to 'flagged'
     - Flagged Items: Expanded by default, sorted by severity. Each row shows:
       - Flag type badge: "Missing in Bank" / "Missing in Ledger" / "Amount Mismatch" / "Date Mismatch" / "Duplicate"
       - Transaction details from whichever side exists
       - Difference amount and days difference
       - Action buttons: "Find Match" (opens search), "Manual Match" (opens dialog), "Exclude" (marks as excluded with note), "Resolve"        
     (marks resolved with note)

     2.1.4 Manual Match Dialog

     - Opens when: User clicks "Manual Match" on a flagged item
     - Shows: The flagged transaction on top
     - Below: Searchable/filterable list of unmatched transactions from the opposite source
     - Search by: Amount range (±tolerance), date range (±days), description keyword
     - Select + "Confirm Match": Creates matched pair in reconciliation_items, updates both items' status to 'manual_match'
     - Note field: Optional resolution note

     2.1.5 Filters & Search

     - Filter bar above workbench:
       - Status filter: All / Matched / Flagged / Excluded
       - Amount range: min-max
       - Date range within session period
       - Description search (free text)
       - Flag type filter (dropdown)

     2.2 Payment Settlement Tab (Future-Ready)

     - Purpose: Match payment gateway transactions against bank deposits
     - Phase 1: "Coming Soon" banner explaining: "Match Stripe/PayPal/Square gateway transactions against bank settlements. Validate fees,     
     match refunds, detect settlement timing differences."
     - Sub-features when built:
       - 2.2.1 Gateway ↔ Bank matching (same workbench pattern as Bank Recon)
       - 2.2.2 Fee Validation — compare expected gateway fee vs actual bank deduction
       - 2.2.3 Refund Matching — link customer refunds to original transactions
       - 2.2.4 Settlement Timing — flag items where bank settlement > N days after gateway capture

     2.3 Cross-System Matching Tab (Future-Ready)

     - Purpose: Match records across ERP, POS, CRM, Inventory
     - Phase 1: "Coming Soon" banner explaining: "Match sales across your ERP, POS, and CRM. Detect revenue leakage when POS records don't     
     appear in ERP."
     - Sub-features when built:
       - 2.3.1 ERP ↔ POS: Match POS daily totals against ERP revenue entries
       - 2.3.2 ERP ↔ CRM: Match CRM deals/opportunities against ERP invoices
       - 2.3.3 ERP ↔ Inventory: Match inventory movements against purchase orders
       - 2.3.4 Multi-Source: Three-way or four-way matching across systems

     2.4 Matching Rules Tab

     Purpose: Configure how the reconciliation engine matches transactions.

     2.4.1 Rules Table

     - DataTable showing all matching_rules for active client:
       - Columns: Priority (drag handle), Name, Type, Amount Tolerance, Date Tolerance, Auto-Match, Status (active/inactive toggle),
     Actions
       - Drag-to-reorder: Changes priority field
       - Default rules created on first access: "Exact Match" (priority 1, 0 tolerance), "Near Amount" (priority 2, ±0.05), "Near Date"        
     (priority 3, 3 days)

     2.4.2 Rule Editor Dialog

     - Fields:
       - Name (text)
       - Description (textarea)
       - Recon Type: Bank / Payment Settlement / Cross-System (radio)
       - Match Criteria (checkboxes): Amount, Date, Description, Sign
       - Amount Tolerance Type: Exact / Cents (±0.01-0.99) / Percent (0-5%) / Fixed Amount
       - Amount Tolerance Value (number input, shown based on type)
       - Date Tolerance Days (number input, 0-30)
       - Auto-Match toggle: If ON, matching items are auto-resolved without review
     - Save: UPSERT into matching_rules

     2.4.3 Rule Testing

     - "Test Rules" button: Runs the matching algorithm on the last reconciliation session data with current rules, shows preview of what      
     would match (without saving). Shows: "X additional matches found with these rules"

     ---
     Page 3: Revenue Integrity (/revenue)

     Purpose: Protect income — detect missing invoices, track collections, monitor AR.
     5 tabs: Revenue Overview | Invoices | Payments & Collections | AR Monitoring | Revenue Variance

     3.1 Revenue Overview Tab

     3.1.1 KPI Cards (top row, 4 cards)

     - Total Revenue: SUM of invoices.total WHERE status IN ('sent','paid','partial') AND client_id = ? AND invoice_date IN period. Shows %    
      change vs previous period.
     - Invoice Count: COUNT of invoices in period. Shows avg invoice value below.
     - Collection Rate: (Paid invoices total / All invoices total) × 100%. Color: green > 90%, amber 70-90%, red < 70%.
     - Outstanding AR: SUM of unpaid/partial invoices. Shows count of overdue invoices below.

     3.1.2 Revenue by Category Chart

     - Bar chart: Groups invoices by category field. Horizontal bars sorted by total descending.
     - Tooltip: Category name + total + count of invoices
     - Click on bar: Filters Invoices tab to that category

     3.1.3 Revenue by Period Chart

     - Line chart: Monthly revenue over selected date range
     - Dual line: Current period (solid) vs Previous period (dashed) for comparison
     - Date range picker at top right

     3.1.4 Revenue by Department / Location

     - Table view: If transactions have department/location metadata → group and subtotal
     - If no metadata: Show info banner "Connect ERP to see department/location breakdowns"

     3.2 Invoices Tab

     3.2.1 Invoice Status Tabs

     - Sub-tabs: All | Draft | Sent | Paid | Overdue | Cancelled
     - Each tab shows count badge
     - Overdue tab: Auto-calculated from due_date < today AND status NOT IN ('paid','cancelled')

     3.2.2 Invoice Table

     - Columns: Invoice #, Customer, Category, Date, Due Date, Amount, Status, Actions
     - Sortable by: Date, Amount, Due Date, Customer
     - Row click: Opens invoice detail sheet (slide-over)
     - Actions: Edit (if draft), Send (if draft), Mark Paid, Cancel, Delete (if draft)

     3.2.3 Invoice Create/Edit

     - Slide-over form:
       - Customer (searchable dropdown from customers table, or create new inline)
       - Invoice number (auto-generated: INV-YYYYMM-NNN, or manual)
       - Invoice date (date picker)
       - Due date (auto-calculated from customer payment_terms, editable)
       - Line items: Description, Quantity, Unit Price, Tax Rate (default 5%), Amount (auto-calculated)
       - Subtotal, Tax Amount, Total (auto-calculated)
       - Notes, Terms (textarea)
       - Category (dropdown from predefined sectors)
     - On save: INSERT/UPDATE invoices + invoice_items (if using line items)

     3.2.4 Duplicate Detection

     - Auto-scan: When creating new invoice, check for existing invoices with same customer + same total ± 5% + same date ± 7 days
     - If potential duplicate found: Show amber warning banner: "Possible duplicate: Invoice INV-2026-042 for AED 5,000 to [Customer] on       
     [Date]"
     - User can dismiss or view the potential duplicate

     3.2.5 Missing Invoice Detection

     - Logic: Compare positive transactions (income) from bank statement against invoices. If a bank deposit > AED 500 has no matching
     invoice (amount ± 10%, date ± 5 days), flag as "Missing Invoice"
     - Shows: Banner at top of Invoices tab: "X transactions have no matching invoice" with list
     - Action per item: "Create Invoice" (pre-fills from transaction data)

     3.3 Payments & Collections Tab

     3.3.1 Payment Allocation Table

     - Shows: Which bank transactions (payments received) are allocated to which invoices
     - Columns: Transaction Date, Bank Description, Amount, Allocated To (invoice #), Remaining
     - Unallocated payments: Highlighted in amber — payments received but not linked to any invoice
     - Over-allocated: Red highlight — payment linked to invoice but amounts don't match

     3.3.2 Underpayments

     - List: Invoices where amount_paid < total_amount AND status = 'partial'
     - Shows: Invoice #, Customer, Invoice Total, Amount Paid, Shortfall, % Paid
     - Action: "Send Reminder" (future), "Write Off" (creates adjustment), "Mark Paid" (override)

     3.3.3 Overpayments

     - List: Transactions allocated to invoices where allocated amount > invoice total
     - Shows: Invoice #, Customer, Invoice Total, Amount Received, Excess
     - Action: "Apply to Next Invoice" (future), "Issue Refund" (creates payable)

     3.4 AR Monitoring Tab

     3.4.1 Aging Summary Chart

     - Stacked horizontal bar chart:
       - Buckets: Current (not yet due), 1-30 days overdue, 31-60, 61-90, 90+
       - Color gradient: green → yellow → orange → red → dark red
       - Shows total amount in each bucket
     - Below chart: Summary stats: Total AR, Total Overdue, Weighted Average Days Outstanding

     3.4.2 Overdue Invoices Table

     - DataTable: Only invoices where due_date < today AND status NOT IN ('paid','cancelled')
     - Columns: Invoice #, Customer, Amount, Due Date, Days Overdue, Last Contact (future), Actions
     - Sorted by: Days overdue (highest first)
     - Actions: "Send Reminder", "Mark Paid", "Add Note"

     3.4.3 Exposure by Customer

     - Bar chart: Top 10 customers by outstanding AR amount
     - Each bar segmented by aging bucket
     - Shows concentration risk: If one customer > 30% of total AR → warning badge
     - Table below: Customer, Total Outstanding, Current, 1-30, 31-60, 61-90, 90+, % of Total AR

     3.5 Revenue Variance Tab

     3.5.1 Period Comparison Table

     - Columns: Month, Revenue, Previous Month Revenue, Change Amount, Change %, Status
     - Status: Normal (green), Spike (blue up arrow if > +2 sigma), Drop (red down arrow if > -2 sigma)
     - Sigma threshold configurable via Control Settings

     3.5.2 Anomaly Flags

     - Flagged months expanded below table showing:
       - Which specific categories drove the variance
       - New customers that appeared / customers that disappeared
       - One-time large transactions vs recurring pattern changes

     3.5.3 Trend Analysis

     - Line chart: Monthly revenue with ±2 sigma band (shaded area)
     - Points outside band highlighted with red dots
     - Baseline period: Rolling 12 months (or all available data if < 12 months)

     ---
     Page 4: Expense Integrity (/expenses)

     Purpose: Control outflows — detect duplicate vendors, flag large transactions, track variance.
     4 tabs: Expense Overview | Vendor Bills | Payments | Expense Variance

     4.1 Expense Overview Tab

     4.1.1 KPI Cards (4 cards)

     - Total Expenses: SUM of bills.total WHERE status IN ('open','paid','partial') AND client_id = ? in period. % change vs previous.
     - Bill Count: Total bills in period. Avg bill value below.
     - Top Vendor: Vendor with highest total spend in period. Shows amount + % of total.
     - Open Bills: Count + total of bills with status 'open' or 'overdue'.

     4.1.2 Expense by Category Chart

     - Donut chart: Expense breakdown by category
     - Legend: Category name + amount + percentage
     - Click segment: Filter bills to that category

     4.1.3 Department Spend Table

     - If ERP connected: Shows spend grouped by department/cost center
     - Columns: Department, Budget (if set), Actual, Variance, % of Budget
     - If no ERP: Show category-level breakdown as proxy

     4.2 Vendor Bills Tab

     4.2.1 Open Bills Table

     - DataTable: All bills with status != 'paid' and != 'cancelled'
     - Columns: Bill #, Vendor, Category, Date, Due Date, Amount, Status, Days Until Due, Actions
     - Status badges: Draft (gray), Open (blue), Partial (amber), Overdue (red)
     - Actions: View, Edit, Mark Paid, Delete

     4.2.2 Duplicate Vendor Detection

     - Auto-scan: On page load, compare vendor names using fuzzy matching (Levenshtein distance ≤ 2)
     - Examples: "DEWA" vs "D.E.W.A.", "Emirates NBD" vs "ENBD", "Etisalat" vs "E& Etisalat"
     - Warning banner: "X potential duplicate vendors detected" with list
     - Each item shows: Vendor A name + spend, Vendor B name + spend, similarity score
     - Actions: "Merge" (keeps one, redirects all bills to it), "Not Duplicate" (dismisses)

     4.2.3 Bill Create/Edit

     - Slide-over form: Mirror of Invoice create but for expenses
     - Vendor select (searchable), bill number, dates, line items, tax, notes

     4.3 Payments Tab

     4.3.1 Payment Tracking Table

     - Shows: All expense transactions (negative amounts from bank) with allocation status
     - Columns: Date, Description, Amount, Allocated To (bill #), Vendor, Category, Status
     - Unallocated: Amber highlight — payment made but not linked to any bill
     - Large Transaction Alert: Red highlight if amount > client-specific threshold (default: top 1% or > 3 sigma)

     4.3.2 Large Transaction Alerts

     - Separate section listing transactions exceeding threshold
     - Each shows: Date, Vendor, Amount, how much larger than average (e.g., "5.2x average transaction")
     - Action: "Acknowledge" (dismisses alert), "Flag for Review" (creates risk_alert)

     4.4 Expense Variance Tab

     4.4.1 Category Variance Table

     - Columns: Category, Current Period Spend, Baseline (rolling avg), Variance Amount, Variance %, Z-Score, Flag
     - Flagged rows: Highlighted when z-score > threshold
     - Drill-down: Click category → see individual transactions driving the variance

     4.4.2 Historical Comparison Chart

     - Grouped bar chart: Current period vs previous period vs same period last year (if data available)
     - By category or by month (toggle)

     4.4.3 Unusual Expense Flags

     - Auto-generated list of anomalies:
       - New vendor with large first transaction
       - Vendor with sudden spend increase (> 2x previous period)
       - Category spend exceeding budget (if budget set)
       - Weekend/holiday transactions (unusual timing)

     ---
     Page 5: Cash & Liquidity (/cash)

     Purpose: Financial stability monitoring.
     3 tabs: Bank Accounts | Cash Flow | Liquidity Risk

     5.1 Bank Accounts Tab

     5.1.1 Account Cards Grid

     - One card per bank_accounts record:
       - Bank name + logo (if available)
       - Account name + last 4 digits
       - Current balance (large, formatted with currency)
       - Last statement date (e.g., "Updated 3 days ago")
       - Reconciliation status badge: "Reconciled" (green) / "Pending" (amber) / "Unreconciled" (red)
       - Quick actions: "Upload Statement", "View Transactions", "Reconcile"

     5.1.2 Total Balance Summary

     - Top of page: Aggregate balance across all accounts
     - Multi-currency: If mixed currencies, show each total separately
     - Warning: If any account not reconciled in > 30 days → amber banner

     5.1.3 Add Bank Account

     - "+ Add Account" button → dialog:
       - Account name, bank name (searchable with UAE/US/UK/India bank presets), account number (last 4 digits), currency, opening balance     
       - Or: "Connect via API" → redirects to Integrations page

     5.2 Cash Flow Tab

     5.2.1 Cash Flow Chart

     - Stacked bar chart (monthly):
       - Green bars (above axis): Inflows (positive transactions)
       - Red bars (below axis): Outflows (negative transactions)
       - Black line: Net cash flow (inflows - outflows cumulative)
     - Date range picker for the period
     - Toggle: Monthly / Weekly / Daily granularity

     5.2.2 Cash Flow Summary

     - Three cards: Total Inflows, Total Outflows, Net Change
     - Period comparison: vs previous period (% change)

     5.2.3 Forecast View (Future)

     - "Coming Soon" banner: "ML-powered cash flow forecasting based on historical patterns, upcoming receivables, and scheduled payables"     
     - When built: Line chart extending 30/60/90 days into future with confidence bands

     5.3 Liquidity Risk Tab

     5.3.1 Liquidity KPIs (3 cards)

     - Cash on Hand: Current total bank balance
     - Short-term Obligations (next 30 days): SUM of bills due in next 30 days + SUM of overdue bills
     - Coverage Ratio: Cash on Hand / Short-term Obligations. Color: green > 2x, amber 1-2x, red < 1x

     5.3.2 Obligations Timeline

     - Horizontal timeline chart (next 90 days):
       - Shows upcoming bill due dates as markers
       - Projected cash balance line (current balance - cumulative obligations)
       - Red zone: where projected balance goes negative
     - Danger date: First date where projected balance < 0 (highlighted in red)

     5.3.3 Coverage Ratio Trend

     - Line chart: Historical coverage ratio over last 12 months
     - Threshold line at 1.0x (minimum safety)

     ---
     Page 6: Financial Reporting (/reports)

     Purpose: Structured financial visibility — supporting tools, not the main event.
     4 tabs: Profit & Loss | Balance Sheet | Cash Flow Statement | Custom Filters

     6.1 Profit & Loss Tab

     - Date range picker (defaults to current fiscal year)
     - Revenue section: Total revenue, breakdown by category (from positive transactions or invoices)
     - Expense section: Total expenses, breakdown by category (from negative transactions or bills)
     - Net Income: Revenue - Expenses (green if positive, red if negative)
     - Comparison column: Previous period (same duration, shifted back)
     - Export: CSV, PDF buttons
     - "Explain" button: Expandable panel explaining calculation methodology

     6.2 Balance Sheet Tab

     - Assets section: Cash (bank balances) + Accounts Receivable (open invoices) + Other Assets (from Chart of Accounts)
     - Liabilities section: Accounts Payable (open bills) + Other Liabilities (from CoA)
     - Equity section: Retained Earnings (cumulative net income) + Other Equity (from CoA)
     - Validation: Assets = Liabilities + Equity (shows balance check)
     - If no Chart of Accounts set up: Show "Estimated" badge + CTA to set up CoA in Control Settings

     6.3 Cash Flow Statement Tab

     - Three sections:
       - Operating Activities: Net income ± non-cash adjustments (AR/AP changes)
       - Investing Activities: Transactions matching INVESTING_PATTERN regex (property, equipment, investment)
       - Financing Activities: Transactions matching FINANCING_PATTERN regex (loan, capital, dividend)
     - Net Change in Cash: Sum of all three sections
     - Reconciliation: Beginning cash + Net change = Ending cash (with bank balance validation)

     6.4 Custom Filters Tab

     - Filter builder (AND logic):
       - Date range
       - Category (multi-select)
       - Account (from Chart of Accounts)
       - Vendor / Customer (searchable)
       - Amount range (min-max)
       - Transaction type (Income / Expense / Transfer)
       - Source (Bank Upload / ERP / POS / Manual)
     - Results table: Filtered transactions with all columns
     - Aggregate bar: Total, Count, Average, Min, Max
     - Export: CSV, JSON, PDF

     ---
     Page 7: Integrations (/integrations)

     Purpose: Infrastructure layer — "We sit above your systems."
     6 tabs: ERP | Banks | POS | CRM | Inventory | Payroll

     7.1 ERP Tab

     - Connection cards for: Odoo, QuickBooks, Zoho Books
     - Each card shows:
       - Provider logo + name
       - Status badge: Connected / Disconnected / Error
       - Last sync time
       - Records synced count
       - "Connect" button (if disconnected) → opens setup dialog
       - "Sync Now" button (if connected) → triggers manual sync
       - "Configure" button → field mapping, sync frequency, entity selection
       - "Disconnect" button
     - Setup dialog flow:
       - Odoo: Server URL + Database + Username + API Key (or password)
       - QuickBooks: OAuth2 redirect flow
       - Zoho: OAuth2 redirect flow
     - Sync entities: Customers, Vendors, Invoices, Bills, Payments, Journal Entries, Products, Chart of Accounts (checkboxes)

     7.2 Banks Tab

     7.2.1 Bank Statement Upload

     - Reuses existing FileUpload.tsx component
     - Drag-and-drop zone: Accepts .xlsx, .xls, .csv, .pdf (50MB max)
     - Upload flow: Same 3-phase process: parse → AI analyze → sync to business records
     - File list: Previous uploads for this client (from uploaded_files), with: file name, bank name, date range, row count, status

     7.2.2 Bank API Connections

     - Cards for bank API providers (future): Plaid, Lean Technologies (UAE), Salt Edge
     - Phase 1: "Coming Soon" cards with description

     7.3 POS Tab

     - Phase 1: "Coming Soon" with supported systems listed: Square, Lightspeed, Vend, Toast
     - When built: Same connection card pattern as ERP

     7.4 CRM Tab

     - Phase 1: "Coming Soon" with: Salesforce, HubSpot, Zoho CRM
     - When built: Sync customers/deals/opportunities

     7.5 Inventory Tab

     - Phase 1: "Coming Soon" with: Cin7, TradeGecko, Odoo Inventory
     - When built: Sync products, stock movements, purchase orders

     7.6 Payroll Tab

     - Phase 1: "Coming Soon" with: WPS (UAE), Bayzat, Gusto, ADP
     - When built: Sync payroll runs, salary payments, employee records

     ---
     Page 8: Risk Monitor (/risk)

     Purpose: Alert command center — "This makes you look enterprise immediately."
     Layout: Risk score banner at top, then 5 tabs below.
     5 tabs: Active Alerts | High-Risk Transactions | Unresolved Mismatches | High Variance | Control Completion

     8.0 Risk Score Banner (always visible)

     - Full-width bar at top of page:
       - Large number: Overall Risk Score (0-100)
       - Color: 0-40 red, 41-60 amber, 61-80 green, 81-100 dark green
       - Breakdown: 5 factors shown as mini progress bars (Reconciliation, Alerts, AR, AP, Data Freshness)
       - "Last calculated: [timestamp]" + "Recalculate" button

     8.1 Active Alerts Tab

     8.1.1 Alert Cards

     - Sorted by: Severity (critical first), then date (newest first)
     - Each card shows:
       - Severity badge (Critical/High/Medium/Low with color)
       - Alert type icon
       - Title (e.g., "Large unmatched transaction — AED 50,000")
       - Description with details
       - Entity link (click to navigate to the related transaction/invoice/etc.)
       - Timestamp
       - Action buttons: "Acknowledge" (status → acknowledged), "Resolve" (status → resolved, requires note), "Dismiss" (status →
     dismissed, requires reason)

     8.1.2 Bulk Actions

     - Checkbox on each card + top bar:
       - "Acknowledge All Selected"
       - "Dismiss All Selected" (requires reason)
     - Filter by: Alert type, severity, date range

     8.2 High-Risk Transactions Tab

     - DataTable of transactions flagged by amount or pattern:
       - Large transactions (> 3 sigma or absolute threshold)
       - Round amounts (exact thousands — e.g., exactly AED 10,000)
       - Unusual timing (weekend/holiday)
       - New counterparty with large first transaction
     - Columns: Date, Description, Amount, Counterparty, Risk Reason, Status (reviewed/unreviewed)
     - "Mark Reviewed" button per row

     8.3 Unresolved Mismatches Tab

     - DataTable of reconciliation_items WHERE status = 'flagged' across all sessions
     - Columns: Session, Date, Source A Description, Source A Amount, Source B Description, Source B Amount, Flag Type, Age (days since        
     flagged)
     - "Go to Reconciliation" link per row → navigates to that session

     8.4 High Variance Tab

     - DataTable combining revenue and expense variance flags:
     - Columns: Metric (e.g., "Monthly Revenue", "Utilities Spend"), Current Value, Baseline, Variance %, Z-Score, Direction (spike/drop),     
     Severity
     - Sparkline chart in each row showing last 6 periods
     - Click row: Drill-down to see individual transactions driving variance

     8.5 Control Completion Tab

     - Checklist showing completion status of financial controls:
       - Bank reconciliation completed this month (checks reconciliation_sessions)
       - All risk alerts addressed (checks risk_alerts WHERE status = 'open')
       - AR aging reviewed (checks last access to AR Monitoring tab — stored in control_settings)
       - Expense variance reviewed
       - Revenue variance reviewed
       - All bank accounts reconciled
       - Chart of Accounts up to date
     - Progress ring: X of Y controls completed
     - Overall Control Score: percentage → feeds into Risk Score

     ---
     Page 9: Control Settings (/settings)

     Purpose: Standardization engine — configure how the system behaves.
     7 tabs: Chart of Accounts | Matching Rules | Tolerance Thresholds | Alert Sensitivity | User Roles | Audit Logs | Client Management       

     9.1 Chart of Accounts Mapping Tab

     - DataTable: All accounts for active client
     - Columns: Code, Name, Type (Asset/Liability/Equity/Revenue/Expense), Parent Account, Status (active/inactive), Actions
     - CRUD: Add, Edit, Delete, Toggle Active
     - Import: "Import Standard CoA" button → applies a template (UAE standard / IFRS / US GAAP)
     - Mapping: Link categories from transactions to specific accounts (e.g., "Food & Beverage" → Account 5200 "Cost of Goods Sold")

     9.2 Matching Rules Tab

     - Same content as Reconciliation → Matching Rules tab (shared component)
     - Additional context: Global defaults vs per-session overrides

     9.3 Tolerance Thresholds Tab

     - Form with sections:
       - Bank Reconciliation: Amount tolerance (cents/percent/fixed), Date tolerance (days)
       - Payment Settlement: Fee tolerance (percent), Settlement timing (days)
       - Cross-System: Amount tolerance, Date tolerance
     - Saved to: control_settings with key 'tolerance_thresholds'
     - "Reset to Defaults" button

     9.4 Alert Sensitivity Tab

     - Form controlling when risk alerts are generated:
       - Large Transaction Threshold: Fixed amount (e.g., AED 50,000) OR statistical (e.g., 3 sigma)
       - Variance Alert Threshold: Sigma value (default 2.0) — higher = fewer alerts
       - AR Overdue Alert: Days past due before alert (default 30)
       - Stale Reconciliation Alert: Days without reconciliation before alert (default 30)
       - Duplicate Detection Sensitivity: Fuzzy match threshold (0.0-1.0, default 0.8)
     - Saved to: control_settings with key 'alert_sensitivity'

     9.5 User Roles & Permissions Tab

     - DataTable of org_members for current org:
       - Columns: Name (from auth user), Email, Role, Joined Date, Last Active, Actions
       - Role dropdown: Owner / Admin / Manager / Member / Viewer
       - Owner can change others' roles; Admin can change Manager/Member/Viewer
     - "Invite User" button → dialog:
       - Email input
       - Role selector
       - "Send Invite" → creates org_members row with accepted_at = null
     - Role permissions (Phase 4 enforcement):
       - Owner: Full access + can delete org
       - Admin: Full access except org deletion
       - Manager: Can view + edit all data, can run reconciliations, cannot manage users
       - Member: Can view + edit data, cannot change settings or manage users
       - Viewer: Read-only access to all pages, cannot edit anything

     9.6 Audit Logs Tab

     - DataTable of audit_logs (read-only, paginated):
       - Columns: Timestamp, User, Action, Entity Type, Entity ID, Changes Summary
       - Filter by: User, Action type, Date range, Entity type
       - Click row → expand to show full old_values and new_values JSON diff
     - Export: CSV download of filtered audit logs
     - Retention: Show total log count + oldest entry date

     9.7 Client Management Tab

     - DataTable of clients for current org:
       - Columns: Name, Currency, Country, Industry, Status, Created, Actions
       - Actions: Edit, Archive, Delete (if no data)
     - "Add Client" button → dialog:
       - Same form as Onboarding step 2 (company name, TRN, currency, etc.)
     - Archive: Sets status = 'archived' — data preserved but client hidden from ClientSwitcher (unless "Show Archived" toggle is on)
