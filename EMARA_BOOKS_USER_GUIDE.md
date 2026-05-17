# EMARA BOOKS — User Guide

**Version 1.0 | March 2026**
**Smart Financial Management Powered by AI**

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Control Center (Dashboard)](#2-control-center)
3. [Uploading Bank Statements](#3-uploading-bank-statements)
4. [Reconciliation](#4-reconciliation)
5. [Revenue Integrity](#5-revenue-integrity)
6. [Creating & Managing Invoices](#6-creating--managing-invoices)
7. [Expense Integrity](#7-expense-integrity)
8. [Creating & Managing Bills](#8-creating--managing-bills)
9. [Cash & Liquidity](#9-cash--liquidity)
10. [Financial Reports](#10-financial-reports)
11. [Integrations (ERP, Banks & More)](#11-integrations)
12. [Risk Monitor](#12-risk-monitor)
13. [Control Settings](#13-control-settings)
14. [Frequently Asked Questions](#14-faq)

---

## 1. Getting Started

### 1.1 Creating Your Account

1. Go to **app.emarabooks.com**
2. Click **Sign Up** and enter your email and password
3. You can also sign in with **Google** for quick access
4. After signing up, you'll be taken to the **Onboarding** screen

### 1.2 Onboarding — Setting Up Your Business

**Step 1: Organization Setup**

| Field | Description |
|-------|-------------|
| Organization Name | Your firm or company name |
| Country | Select your country (UAE, US, UK, India, Saudi, etc.) |
| Default Currency | AED, USD, GBP, EUR, INR, SAR, etc. |
| VAT Rate | Default is 5% for UAE businesses |
| Fiscal Year Start | Usually January for UAE companies |

**Step 2: Client Setup**

| Field | Description |
|-------|-------------|
| Client/Company Name | The business you're managing books for |
| Currency | The primary currency for this client |
| Industry | Select your business sector (IT, Retail, Food & Beverage, etc.) |
| Trade License (Optional) | Your trade license number |
| TRN (Optional) | Tax Registration Number for VAT |

After completing onboarding, you'll land on the **Control Center** — your financial command center.

### 1.3 Navigation

The left sidebar gives you access to all sections:

- **Control Center** — Executive dashboard with key metrics
- **Reconciliation** — Match bank transactions to your records
- **Revenue Integrity** — Track income, invoices, and customers
- **Expense Integrity** — Track expenses, bills, and vendors
- **Cash & Liquidity** — Monitor cash position and bank accounts
- **Financial Reports** — P&L, Balance Sheet, Cash Flow, Ratios
- **Integrations** — Upload statements, connect ERP systems
- **Risk Monitor** — Alerts, anomalies, and risk scoring
- **Control Settings** — Configure your account and preferences

### 1.4 Date Range Filter

At the top of most pages, you'll see a **date range picker**. This controls what data is displayed across all charts, tables, and metrics on that page.

**Preset options:** This Month, Last Month, This Quarter, Last Quarter, This Year, Last Year, Last 12 Months, All Time, or a Custom Range.

---

## 2. Control Center

The **Control Center** is your financial command center — a single-page overview of your business health.

### Key Metric Cards

| Card | What It Shows |
|------|---------------|
| **Basic Insight** | Risk score (0–100) based on reconciliation health, alerts, AR/AP exposure, and data freshness |
| **AI Insight** | AI-generated risk assessment and recommendations (click "Generate" to run) |
| **Total Balance** | Combined balance across all your bank accounts |
| **Match Rate** | Percentage of bank transactions successfully matched to bills/invoices |
| **Expenses** | Total debits (money going out) in the selected period |
| **Revenue** | Total credits (money coming in) in the selected period |
| **Open Alerts** | Number of unresolved risk alerts (high severity shown separately) |
| **Data Sources** | Number of uploaded files and live integrations |

### Charts

- **Revenue & Expense Trend** — 6-month line chart showing income vs spending patterns
- **Reconciliation Summary** — Shows matched vs flagged transactions with counts

### Drill-Down

Click any metric card to open a detailed breakdown with the underlying transactions.

---

## 3. Uploading Bank Statements

### 3.1 How to Upload

1. Go to **Integrations** → **Banks** tab
2. Drag and drop your file into the upload area, or click **Select File**
3. Supported formats: **Excel (.xlsx, .xls)** and **PDF (.pdf)**
4. Maximum file size: **50 MB**

### 3.2 What Happens After Upload

1. **Parsing** — The system reads your bank statement and extracts all transactions
2. **Categorization** — Each transaction is automatically categorized (Food & Beverage, Transportation, Utilities, etc.)
3. **Sync** — Vendors, customers, bills, invoices, and bank account records are automatically created
4. **Alerts** — Risk alerts are generated for suspicious or large transactions

You'll see a success toast showing how many transactions were imported.

### 3.3 Supported Banks

The system automatically detects your bank from the statement. Supported banks include:

**UAE:** ADCB, FAB, ENBD, Mashreq, CBD, HSBC ME, RAKBANK, ADIB, Wio Bank
**International:** Bank of America, Chase, Wells Fargo, Citibank, Barclays, Lloyds, SBI, HDFC, ICICI

### 3.4 Managing Uploaded Files

In the **Uploaded Statements** section, you can see:
- File name (PDF name or bank name)
- Number of rows parsed
- Currency detected
- Upload date
- Processing status

Click the **trash icon** to delete a file and all its associated data (transactions, bills, invoices, etc.).

### 3.5 Duplicate Prevention

The system checks for duplicate uploads. If you try to upload the same statement twice (same bank name and row count), it will show a warning and skip the duplicate.

---

## 4. Reconciliation

Reconciliation ensures your bank transactions match your accounting records.

### 4.1 Starting a Reconciliation

1. Go to **Reconciliation**
2. Click **Start Reconciliation**
3. The system automatically matches bank transactions to bills and invoices using a 4-pass algorithm:
   - Pass 1: Match expenses to bills (by amount, date, and vendor)
   - Pass 2: Match income to invoices (by amount, date, and customer)
   - Pass 3: Flag unmatched bank transactions
   - Pass 4: Flag unmatched bills/invoices

### 4.2 Understanding Match Results

Each item gets a status:

| Status | Color | Meaning |
|--------|-------|---------|
| Matched | Green | Successfully matched to a bill or invoice |
| Missing Bill | Amber | Bank transaction has no corresponding bill |
| Missing Invoice | Amber | Bank deposit has no corresponding invoice |
| Amount Mismatch | Red | Amounts don't match exactly |
| Date Mismatch | Orange | Dates differ significantly |
| Duplicate Suspect | Purple | Possible duplicate transaction |
| Large Transaction | Red | Amount exceeds your threshold |
| Verified | Green | You've manually confirmed the match |

### 4.3 Manual Matching

For items the system couldn't automatically match:
1. Click on the flagged item
2. Review the details (amount, date, description)
3. Click **Link** to manually match it to a bill or invoice
4. Or click **Verify** to confirm the transaction is correct as-is

### 4.4 Matching Rules

Create reusable rules to automatically match recurring transactions:
1. Go to **Matching Rules** tab
2. Click **Create Rule**
3. Set the pattern (e.g., "DEWA" always matches to "Utilities")
4. Future reconciliations will apply this rule automatically

### 4.5 Finalizing

Once all flagged items are resolved:
1. Click **Finalize**
2. The session is locked with a timestamp and your name for audit purposes
3. The match rate is calculated and saved

---

## 5. Revenue Integrity

Track all your income, invoices, customers, and collections.

### 5.1 Revenue Overview

The overview tab shows:
- **Total Revenue** — All income in the selected period
- **Outstanding Receivables** — Invoices not yet paid
- **Overdue Amount** — Invoices past their due date
- **Collection Rate** — Percentage of invoices that have been paid

Charts show monthly revenue trends, invoice status distribution, top customers, and revenue by category.

### 5.2 Invoices Tab

View and manage all your invoices:
- Filter by status: All, Draft, Sent, Paid, Overdue, Cancelled
- Filter by category
- Toggle between **Grid view** (cards) and **Table view**
- Click any invoice to view details or edit

### 5.3 AR Aging

Shows how long invoices have been outstanding:
- **Current** (0–30 days)
- **31–60 days**
- **61–90 days**
- **90+ days** (critical — needs immediate follow-up)

Click any aging bucket to see the specific invoices in that range.

### 5.4 Customers

View all your customers with:
- Total revenue per customer
- Number of invoices
- Payment status (on-time, overdue)
- Contact details

### 5.5 Payments & Collections

Track actual cash received from customers:
- See which payments are matched to which invoices
- Identify unallocated payments (money received but not matched to any invoice)
- Excludes internal transfers and bank fees — only real customer payments

---

## 6. Creating & Managing Invoices

### 6.1 Creating a New Invoice

1. Go to **Revenue Integrity** → **Invoices** tab
2. Click **+ New Invoice**
3. Fill in the form:

| Field | Description |
|-------|-------------|
| Customer | Select or type a customer name (auto-creates if new) |
| Invoice Number | Auto-generated (e.g., INV-202603-001) or custom |
| Invoice Date | Date the invoice is issued |
| Due Date | When payment is expected (default: 30 days) |
| Category | Business category (e.g., Professional Services) |

4. **Add Line Items:**
   - Description (e.g., "Web Development Services")
   - Quantity
   - Unit Price
   - Tax Rate (default 5% for UAE VAT)
   - Amount is calculated automatically

5. Add optional **Notes / Payment Terms**

6. Click **Save Draft** or **Update & Send**

### 6.2 Live Preview

As you fill in the form, a **Live Preview** on the right shows exactly how the invoice will look, including:
- Your company details (from Invoice Profile)
- Customer billing address
- Line items with tax calculation
- Subtotal, Tax, and Total

### 6.3 Invoice Profile

Click **Invoice Profile** to customize your company details shown on invoices:
- Company name and address
- Phone, email
- TRN (Tax Registration Number)
- Logo (upload or text)

### 6.4 Invoice Template

Click **Customize** to change the invoice design:
- Layout style: Classic, Modern, or Minimal
- Accent color (choose from palette)
- Footer text
- Toggle: show/hide logo, TRN, due date, notes, payment terms

### 6.5 Invoice Actions

| Action | Description |
|--------|-------------|
| Save Draft | Save without sending |
| Update & Send | Save and mark as sent |
| Edit | Modify an existing invoice |
| Delete | Remove the invoice permanently |
| Change Status | Set to Draft, Sent, Paid, Overdue, or Cancelled |

---

## 7. Expense Integrity

Track all your expenses, bills, vendors, and payments.

### 7.1 Expense Overview

Shows:
- **Total Expenses** — All spending in the selected period
- **Payables Outstanding** — Bills not yet paid
- **Overdue AP** — Bills past their due date
- **Payment Cycle** — Average days to pay vendors

Charts show monthly expense trends, bill status distribution, top vendors, and expenses by category.

### 7.2 Bills Tab

View and manage all your bills (purchase invoices from vendors):
- Filter by status: All, Pending, Partial, Paid, Overdue, Cancelled
- Filter by category and vendor
- Toggle between Grid and Table view

### 7.3 AP Aging

Same aging analysis as AR, but for your payables:
- Current, 31–60 days, 61–90 days, 90+ days
- Helps prioritize which vendors to pay first

### 7.4 Vendors

View all your vendors with:
- Total spend per vendor
- Number of bills
- Outstanding balance
- Category assignment

---

## 8. Creating & Managing Bills

### 8.1 Creating a New Bill

1. Go to **Expense Integrity** → **Bills** tab
2. Click **+ New Bill**
3. Fill in:
   - **Vendor** — Select or type vendor name (auto-creates if new)
   - **Bill Number** — From the vendor's invoice
   - **Bill Date** — Date on the vendor's invoice
   - **Due Date** — When you need to pay
   - **Amount** — Total amount
   - **Category** — Expense category
   - **Notes** — Optional details

4. Click **Save**

### 8.2 Bill Status Flow

| Status | Meaning |
|--------|---------|
| Pending | Bill received, not yet paid |
| Partial | Partially paid |
| Paid | Fully paid |
| Overdue | Past due date and unpaid |
| Cancelled | Voided/cancelled |

---

## 9. Cash & Liquidity

Monitor your cash position and bank account health.

### 9.1 Cash Overview

- **Total Cash Balance** — Combined balance across all bank accounts
- **Cash Flow** — Net inflow vs outflow for the period
- **Cash Position Chart** — Daily/weekly/monthly balance trend
- **Inflow vs Outflow** — Visual comparison

### 9.2 Bank Accounts

View all detected bank accounts:
- Account name and bank
- Current balance
- Currency
- Last transaction date

### 9.3 Cash Ledger

Accounting-style ledger view:
- Date, Description, Debit, Credit, Running Balance
- Filter by year
- Shows Dr/Cr suffix on net balance

### 9.4 Transactions

Full list of all transactions with:
- Search by description
- Filter by category, amount range, type (deposit/withdrawal)
- Click any transaction for full details
- Category auto-assigned using smart merchant recognition

---

## 10. Financial Reports

Generate the four core financial statements.

### 10.1 Profit & Loss (P&L)

Shows income vs expenses for a period:
- **Revenue** — Broken down by category
- **Expenses** — Broken down by category
- **Net Income** — Revenue minus Expenses

Features:
- Period selector (This Month, Last Quarter, This Year, Custom)
- Previous period comparison (shows YoY change %)
- Monthly trend chart
- Category drill-down (click any category to see transactions)
- Excludes non-P&L items (internal transfers, ATM withdrawals, banking fees)

### 10.2 Balance Sheet

Shows your financial position at a point in time:
- **Assets** — What you own (cash, receivables)
- **Liabilities** — What you owe (payables)
- **Equity** — Net worth (Assets minus Liabilities)

Requires Chart of Accounts setup for full accuracy. Without CoA, shows a simplified statement summary.

### 10.3 Cash Flow Statement

Categorizes all cash movement into:
- **Operating Activities** — Day-to-day business cash flows
- **Investing Activities** — Asset purchases, investments
- **Financing Activities** — Loans, equity, distributions
- **Net Cash Flow** — Total change in cash

### 10.4 Financial Ratios

Key performance indicators:
- **Profitability:** Net Profit Margin, Gross Margin
- **Liquidity:** Current Ratio, Working Capital
- **Efficiency:** Receivables Turnover, DSO (Days Sales Outstanding)
- **Growth:** Revenue Growth %, Expense Growth %

Each ratio shows a trend indicator (up/down) and comparison to the previous period.

### 10.5 Custom Filters

Build your own reports:
- Select date range, categories, account types, amount ranges
- View results in a table
- Download to CSV

---

## 11. Integrations

Connect external systems and upload data.

### 11.1 Banks Tab

Upload bank statements and manage uploaded files.

**Uploading:** Drag & drop or click to upload Excel/PDF files.

**Uploaded Statements:** Shows all uploaded files with:
- Original PDF/Excel filename
- Bank name, rows parsed, currency
- Upload date
- Delete option (removes file and all associated data)

### 11.2 ERP Tab (Odoo)

Connect your Odoo ERP to sync data:

**Connecting:**
1. Click **Connect** on the Odoo card
2. Enter your Odoo credentials:
   - **Server URL** — e.g., `https://mycompany.odoo.com`
   - **Database** — Your Odoo database name (auto-detected from URL)
   - **Username** — Your Odoo login email
   - **Password** — Your Odoo login password
   - **API Key** (Optional) — For advanced users
3. Click **Connect**

**Importing Data:**
1. Click **Sync Data** on the connected Odoo card
2. Choose what to import:
   - **Customers** — Import customer contacts from Odoo
   - **Vendors** — Import supplier contacts from Odoo
   - **Invoices (Sales)** — Import customer invoices
   - **Bills (Purchases)** — Import vendor bills
3. Click **Import** for each entity type

**Imported Data Section:**
After importing, the **Imported ERP Data** section shows:
- Counts: Invoices, Bills, Customers, Vendors imported
- Tables with full details for each entity type
- Data is tagged as source "odoo" for tracking

**Supported entity types:** Customers, Vendors, Invoices (Sales), Bills (Purchases)
**Coming soon:** Payments, Journal Entries, Products, Chart of Accounts

### 11.3 Other Integrations (Coming Soon)

- **POS** — Square, Lightspeed, Toast, Vend
- **CRM** — Salesforce, HubSpot, Zoho CRM
- **Inventory** — Cin7, Odoo Inventory, TradeGecko
- **Payroll** — WPS (UAE), Bayzat, Gusto, ADP

---

## 12. Risk Monitor

Proactively identify financial risks and anomalies.

### 12.1 Risk Overview

Shows all open alerts with severity breakdown:
- **Critical** (Red) — Immediate attention required
- **High** (Orange) — Review soon
- **Medium** (Amber) — Monitor
- **Low** (Blue) — Informational

Alert types include:
- Reconciliation flags (mismatches, duplicates)
- Overdue invoices and bills
- Anomaly detections (unusual spending spikes/drops)
- Large transactions above threshold
- Data quality issues

### 12.2 Anomaly Detection

The system automatically analyzes 6 months of transaction data to detect:
- Revenue spikes or drops
- Expense spikes or drops
- Unusual patterns in specific categories
- Cash flow anomalies

Each anomaly shows the baseline (normal), actual amount, and variance percentage.

### 12.3 Resolving Alerts

1. Click on any alert to view details
2. Review the root cause and recommended action
3. Click **Resolve** to mark it as handled
4. Resolved alerts are archived for audit purposes

---

## 13. Control Settings

Configure your account, Chart of Accounts, thresholds, and more.

### 13.1 Profile

Edit your organization and client details:
- Organization name, country, currency, VAT rate
- Client name, industry, TRN, Trade License

### 13.2 Chart of Accounts

Set up your accounting structure:
- **Assets** — Cash, bank accounts, receivables, equipment
- **Liabilities** — Payables, loans, credit cards
- **Equity** — Owner's capital, retained earnings
- **Revenue** — Sales, service income, other income
- **Expenses** — Operating costs by category

Use **industry templates** to quickly set up a standard Chart of Accounts for your business type.

### 13.3 Matching Rules

Create patterns for automatic transaction matching:
- Rule name and description pattern
- Match by amount, date, or counterparty
- Rules are applied automatically during reconciliation

### 13.4 Thresholds

Configure alert sensitivity:

| Threshold | Default | Description |
|-----------|---------|-------------|
| Large Transaction | 50,000 AED | Flags transactions above this amount |
| Overdue Invoice | 30 days | Alert when invoice is past due |
| Overdue Bill | 30 days | Alert when bill is past due |
| Variance | 50% | Alert when spending deviates from baseline |

### 13.5 Audit Log

View a history of all actions taken in the system:
- Who did what, when
- Changes to invoices, bills, settings
- For compliance and accountability

---

## 14. FAQ

### Q: What file formats can I upload?
**A:** Excel (.xlsx, .xls) and PDF (.pdf) bank statements from any bank.

### Q: How does automatic categorization work?
**A:** The system recognizes merchant names and assigns them to business categories. For example, "ADNOC" → Transportation, "Carrefour" → Food & Beverage, "Etisalat" → Utilities. It knows 500+ merchants and 27 business categories.

### Q: Can I manage multiple businesses?
**A:** Yes. Each "Client" in the system represents a separate business. You can create multiple clients under one organization and switch between them.

### Q: How is VAT calculated on invoices?
**A:** UAE VAT is 5%. When you create an invoice, the system automatically calculates: Subtotal = Amount / 1.05, VAT = Amount - Subtotal.

### Q: What currencies are supported?
**A:** AED, USD, EUR, GBP, INR, SAR, QAR, BHD, KWD, OMR, and more. Each client can have its own currency.

### Q: How do I connect my Odoo ERP?
**A:** Go to Integrations → ERP tab → Click Connect on Odoo → Enter your server URL, database, username, and password → Click Connect. Then use "Sync Data" to import your records.

### Q: What if I upload the wrong file?
**A:** Go to Integrations → Banks → find the file under "Uploaded Statements" → click the trash icon. This deletes the file and ALL associated data (transactions, bills, invoices, vendors, customers).

### Q: How often should I reconcile?
**A:** We recommend reconciling after every bank statement upload. Monthly reconciliation is the minimum for accurate financial reporting.

### Q: What does the Risk Score mean?
**A:** The Basic Insight score (0–100) reflects your overall financial health:
- **80–100:** Excellent — well reconciled, low risk
- **50–79:** Moderate — some areas need attention
- **Below 50:** High Risk — significant unresolved issues

### Q: Can multiple users access the same account?
**A:** Multi-user support with roles (Admin, Manager, Accountant, Viewer) is planned for a future release.

### Q: Is my data secure?
**A:** Yes. All data is encrypted in transit (HTTPS) and at rest. Authentication uses Supabase Auth with JWT tokens. API requests are rate-limited and require authentication.

---

## Support

For help or feedback:
- Visit: **app.emarabooks.com**
- Email: **support@emarabooks.com**

---

*EMARA Books — Smart Financial Management Powered by AI*
*Copyright 2026 EMARA. All Rights Reserved.*
