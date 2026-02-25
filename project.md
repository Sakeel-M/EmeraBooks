# EmeraBooks — Project Documentation

## Overview

**EmeraBooks** is an AI-powered bookkeeping and financial management web application built for UAE-based businesses. Users upload bank statements (Excel/CSV), the app parses transactions, categorizes them using AI + keyword mapping, and presents a full suite of financial reports — P&L, balance sheet, cash flow, ledger, vendors, invoices, budgets, and more.

**Live URL:** https://app.emarabooks.com
**GitHub:** https://github.com/Sakeel-M/EmeraBooks

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool |
| Tailwind CSS | 3 | Styling |
| shadcn/ui | latest | Component library |
| TanStack Query | 5 | Server state / caching |
| Recharts | 2 | Charts |
| date-fns | 3 | Date utilities |
| Lucide React | latest | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.12.3 | Runtime |
| Flask | 3.x | Web framework |
| Gunicorn | latest | WSGI server (4 workers) |
| OpenAI SDK | 2.24.0 | AI analysis (GPT-4o-mini) |
| openpyxl / pandas | latest | Excel parsing |
| Flask-Limiter | latest | Rate limiting |
| Flask-CORS | latest | Cross-origin requests |

### Database & Auth
| Service | Purpose |
|---------|---------|
| Supabase (PostgreSQL) | Main database |
| Supabase Auth | User authentication (email/password) |
| Supabase Edge Functions | Serverless functions (future) |
| Supabase Storage | Document storage |
| Supabase RLS | Row-level security (user data isolation) |

---

## Architecture

```
Browser (React SPA)
    │
    ├── Supabase JS Client → Supabase Cloud (PostgreSQL + Auth + Storage)
    │       All CRUD operations, auth, file metadata
    │
    └── api.ts (fetch) → Flask Backend (VPS 72.60.222.167:5000)
            File upload + parsing → Excel/PDF processor
            AI analysis → OpenAI GPT-4o-mini
```

### Two-Backend Pattern
- **Supabase** handles: authentication, all database reads/writes, real-time, storage
- **Flask** handles: Excel/PDF file parsing, OpenAI API calls, CPU-heavy processing
- Frontend `.env` has both `VITE_SUPABASE_URL` and `VITE_API_BASE_URL`

---

## Project File Structure

```
BookKeeping-master/
├── backend/
│   ├── app.py                  ← Flask routes + OpenAI calls + security
│   ├── excel_processor.py      ← Excel/CSV parser, date detection, category mapping
│   ├── pdf_processor.py        ← PDF bank statement parser
│   ├── requirements.txt        ← Python dependencies
│   └── .env.example            ← Environment variable template
│
├── frontend/
│   ├── public/
│   │   └── UAE_Dirham_Symbol.svg  ← Official AED symbol SVG
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   │   ├── AreaTrendChart.tsx
│   │   │   │   ├── DonutChart.tsx
│   │   │   │   ├── GradientBarChart.tsx
│   │   │   │   └── SpendingCharts.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── AddReportTab.tsx       ← Upload + file list
│   │   │   │   ├── AIInsightsTab.tsx      ← AI health score + tips
│   │   │   │   ├── ExpensesTab.tsx        ← Expense breakdown
│   │   │   │   ├── MetricCards.tsx        ← KPI cards
│   │   │   │   ├── OverviewTab.tsx        ← Home overview
│   │   │   │   ├── RecentActivity.tsx     ← Latest transactions
│   │   │   │   ├── RevenueTab.tsx         ← Revenue breakdown
│   │   │   │   └── TransactionsTab.tsx    ← Full transaction table
│   │   │   ├── financials/
│   │   │   │   ├── AgingReportCard.tsx
│   │   │   │   ├── CategoryDetailPanel.tsx
│   │   │   │   ├── FinancialDetailSheet.tsx
│   │   │   │   ├── FinancialRatiosCard.tsx
│   │   │   │   ├── PLDetailTable.tsx       ← P&L detail with date range
│   │   │   │   ├── RatioDetailSheet.tsx
│   │   │   │   ├── RevenueExpenseTrend.tsx
│   │   │   │   ├── TaxationReport.tsx
│   │   │   │   └── YoYComparisonChart.tsx
│   │   │   ├── layout/
│   │   │   │   └── Layout.tsx             ← Sidebar + top nav
│   │   │   ├── shared/
│   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   ├── CurrencyInput.tsx
│   │   │   │   ├── DirhamSymbol.tsx       ← UAE Dirham SVG inline component
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   ├── EnhancedDateRangePicker.tsx
│   │   │   │   └── FormattedCurrency.tsx  ← SVG Dirham + number display
│   │   │   ├── vendors/
│   │   │   │   ├── VendorGroupedList.tsx
│   │   │   │   └── VendorInsightsPanel.tsx
│   │   │   └── FileUpload.tsx
│   │   ├── hooks/
│   │   │   ├── useCurrency.ts             ← Currency from user_preferences
│   │   │   └── use-toast.ts
│   │   ├── integrations/supabase/
│   │   │   └── client.ts                  ← Supabase client instance
│   │   ├── lib/
│   │   │   ├── api.ts                     ← Flask API client (X-API-Key header)
│   │   │   ├── chartColors.ts             ← Shared chart color palette
│   │   │   ├── database.ts                ← All Supabase queries + sync logic
│   │   │   ├── export.ts                  ← CSV export with injection sanitization
│   │   │   ├── payables.ts                ← Payables/receivables helpers
│   │   │   ├── predefinedSectors.ts       ← 27 business sector definitions
│   │   │   ├── sectorMapping.ts           ← Category resolution engine
│   │   │   └── utils.ts                   ← formatAmount, formatCompactCurrency
│   │   ├── pages/
│   │   │   ├── Index.tsx                  ← Home / Dashboard
│   │   │   ├── Financials.tsx             ← P&L, Balance Sheet, Cash Flow, etc.
│   │   │   ├── Bills.tsx                  ← Expense transactions view
│   │   │   ├── Invoices.tsx               ← Income transactions view
│   │   │   ├── Vendors.tsx                ← Vendor management
│   │   │   ├── Customers.tsx              ← Customer management
│   │   │   ├── Ledger.tsx                 ← Account ledger
│   │   │   ├── Budget.tsx                 ← Budget vs actuals
│   │   │   ├── Banks.tsx                  ← Bank accounts overview
│   │   │   ├── Documents.tsx              ← Document storage
│   │   │   ├── Accounting.tsx             ← Chart of Accounts, Trial Balance, Journal Entries
│   │   │   ├── Analytics.tsx              ← AI analysis charts
│   │   │   ├── Integrations.tsx           ← Data export / OAuth integrations
│   │   │   ├── Settings.tsx               ← User preferences, clear data
│   │   │   └── Auth.tsx                   ← Login / signup
│   │   └── App.tsx                        ← Router
│   ├── supabase/
│   │   └── migrations/                    ← SQL schema migrations
│   ├── .env                               ← Frontend env vars (Supabase + API keys)
│   └── package.json
│
├── deploy.md                              ← Deployment guide (this sibling file)
└── project.md                             ← This file
```

---

## Pages & Features

### Home / Dashboard (`Index.tsx`)
- Upload bank statement (Excel/CSV/PDF) → Flask parses → saves to Supabase
- Auto-detects bank name, currency, date format (DD/MM vs MM/DD)
- Phase 1: immediate transaction save with category mapping
- Phase 2: background AI analysis (GPT-4o-mini) → health score, tips, alerts
- Phase 3: background sync → creates vendors, customers, bills, invoices from transactions
- Tabs: Overview, Expenses, Revenue, Transactions, AI Insights, Add Report
- KPI cards: Total Income, Total Expenses, Net Flow, Transaction Count
- Duplicate file detection — re-uploading same file loads existing data

### Financials (`Financials.tsx`)
- **Overview tab** — Revenue, Expenses, Net Income, Profit Margin cards + trend chart
- **P&L tab** — Independent date picker (auto-detects full transaction span), P&L bar chart + donut chart
- **P&L Detail tab** — Custom date range replaces quarter navigator; single-column detailed breakdown by category
- **Balance Sheet tab** — 3 states: empty / real CoA data / estimated from bank statement
- **Cash Flow tab** — Operating / Investing / Financing classified by regex patterns
- **Taxation tab** — UAE 5% VAT calculation, quarterly breakdown
- **YoY tab** — Year-over-year revenue and expense comparison charts
- "Explain" panel — shows calculation methodology for each figure
- All P&L figures sourced from `transactions` table (same source as Home)

### Bills (`Bills.tsx`)
- Shows expense transactions (`amount < 0`) from `transactions` table
- Year filter with auto-detection of latest year
- Category pills for filtering
- Manual bills section (draft/pending bills created manually)

### Invoices (`Invoices.tsx`)
- Shows income transactions (`amount > 0`) from `transactions` table
- Status tabs: All / Draft / Sent / Paid / Overdue / Cancelled
- Year filter, category pills, grid/table toggle
- InvoiceCard component for grid view

### Vendors (`Vendors.tsx`)
- Aggregated vendor list from bills
- List view: category badge with tooltip explaining why category was assigned
- Grouped view: grouped by category with subtitle showing how many matched by name vs transactions
- Spend over time chart, active vendor count
- Dynamic balance calculated from bills (not stale DB column)

### Customers (`Customers.tsx`)
- Customer list from invoices
- Overdue detection from `due_date` field
- Outstanding receivables calculation

### Ledger (`Ledger.tsx`)
- Double-entry ledger view grouped by account/category
- Year auto-detection from most recent transaction
- Net Balance with Dr/Cr suffix
- Account resolution: `resolveCategory()` first, then `guessCategory()` fallback

### Budget (`Budget.tsx`)
- Set spending targets per category
- Actual spending pulled from transactions using `resolveCategory()`
- Progress bars, over-budget alerts

### Banks (`Banks.tsx`)
- Bank accounts overview
- Multi-currency total balance (groups by currency, warns if mixed AED+USD)

### Accounting (`Accounting.tsx`)
- **Chart of Accounts** — Real balance sheet setup; bills sync with Dr/Cr journal entries
- **Trial Balance** — Debit/Credit columns, CSV export
- **Journal Entries** — Manual double-entry with account picker

### Analytics (`Analytics.tsx`)
- AI-generated monthly trend charts from `ai_analysis` field
- Separate from Financials — uses stored AI output not live transaction data

### Documents (`Documents.tsx`)
- File upload/download storage via Supabase Storage
- 50MB limit, user_id scoped

### Integrations (`Integrations.tsx`)
- Paginated data export (CSV)
- OAuth credentials stored in sessionStorage (cleared on tab close)

### Settings (`Settings.tsx`)
- Currency preference (AED / USD / GBP / EUR etc.)
- Clear All Data — deletes from all 10 tables

---

## Database Schema (Supabase)

### `uploaded_files`
```sql
id, user_id, file_name, bank_name, currency, total_transactions, created_at
```

### `transactions`
```sql
id, user_id, file_id, transaction_date, description, amount, category,
balance, transaction_type, created_at
```

### `bills`
```sql
id, user_id, source_file_id, vendor_id, bill_number, bill_date, due_date,
category, total_amount, status, notes, created_at
```

### `invoices`
```sql
id, user_id, source_file_id, customer_id, invoice_number, invoice_date,
due_date, category, subtotal, tax_amount, total_amount, status, notes, created_at
```

### `vendors`
```sql
id, user_id, name, category, email, phone, address, total_spent, created_at
```

### `customers`
```sql
id, user_id, name, category, email, phone, address, total_revenue, created_at
```

### `accounts` (Chart of Accounts)
```sql
id, user_id, account_name, account_type, account_code, balance, created_at
```

### `bank_accounts`
```sql
id, user_id, bank_name, account_number, currency, balance, created_at
```

### `journal_entries`
```sql
id, user_id, entry_date, description, debit_account, credit_account,
amount, created_at
```

### `budgets`
```sql
id, user_id, category, budget_amount, period, created_at
```

### `reconciliations`
```sql
id, user_id, file_id, status, notes, created_at
```

### `payables_receivables`
```sql
id, user_id, type, party_name, amount, due_date, status, created_at
```

### `documents`
```sql
id, user_id, file_name, file_url, file_size, created_at
```

### `user_preferences`
```sql
id, user_id, currency, theme, created_at
```

### `ai_analysis`
```sql
id, user_id, file_id, health_score, score_category, monthly_trends,
insights, tips, alerts, created_at
```

---

## Upload & Sync Flow

```
User drops file
    │
    ├── FileUpload.tsx checks: 50MB limit + MIME type (xlsx/xls/csv/pdf)
    │
    ├── PHASE 1 (immediate, ~2s)
    │   ├── POST /api/upload → Flask
    │   │   ├── excel_processor.py parses file
    │   │   ├── Detects bank name, currency, date format
    │   │   ├── Maps raw categories → canonical sector names
    │   │   └── Returns: { transactions[], bank_info }
    │   └── database.ts saveTransactions() → Supabase
    │       ├── Creates uploaded_files record
    │       └── Bulk inserts transactions with getCanonicalCategory()
    │
    ├── PHASE 2 (background, ~10s)
    │   └── POST /api/analyze → Flask
    │       ├── Sends transaction summary to GPT-4o-mini
    │       └── Returns health_score, insights, tips, alerts
    │       └── database.ts saveAnalysis() → upserts ai_analysis row
    │
    └── PHASE 3 (background, ~3s)
        └── database.ts syncBankDataToBusinessRecords()
            ├── Guard: skip if already synced (checks bills count by file_id)
            ├── PASS 1: extract unique vendor names from expense transactions
            ├── PASS 2: bulk upsert vendors (on_conflict: name)
            ├── PASS 3: extract unique customer names from income transactions
            ├── PASS 4: bulk upsert customers (on_conflict: name)
            ├── PASS 5: build bills array with vendor_id, category, amount
            ├── PASS 6: chunked upsert bills (500/batch, on_conflict: bill_number)
            ├── PASS 7: build invoices + chunked upsert (500/batch)
            └── Shows toast: "X bills, Y invoices synced"
```

---

## Category Resolution Engine (`sectorMapping.ts`)

Three tiers of category resolution, applied in priority order:

### `getCanonicalCategory(rawCategory, entityName, description)`
1. `guessCategory(entityName)` — keyword match on vendor/customer name (most reliable)
2. `guessCategory(description)` — keyword match on transaction description
3. `resolveCategory(rawCategory, entityName)` — clean up stored category string

### `guessCategory(text)`
- Strips UPOS/POS prefix patterns (`UPOS Purchase DD/MM HH:MM`, `POS-DD/MM-`)
- Checks ATM patterns first
- Matches against 20 SECTOR_KEYWORDS entries (order matters — Technology before Retail)
- UAE-aware: DEWA→Utilities, Etisalat→Telecom, SALIK→Transport, etc.
- US-aware: Amazon→Retail, Walmart→Retail, SQ*→Finance, etc.

### Canonical Sector Names (27 sectors)
Food & Beverage, Transportation & Logistics, Retail & Shopping, Utilities,
Healthcare, Entertainment & Media, Technology, Finance & Banking,
Real Estate, Education, Travel & Tourism, Telecommunications,
Professional Services, Legal Services, Manufacturing, Construction,
Agriculture, Energy, Marketing & Advertising, Hospitality,
Non-profit, Government, E-commerce, Automotive, Fashion & Apparel,
Internal Transfer, Other

---

## Flask API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check → `{ status: "ok" }` |
| POST | `/api/upload` | Parse Excel/CSV/PDF → return transactions |
| POST | `/api/analyze` | AI analysis via GPT-4o-mini |

### Security
- `X-API-Key` header required on all routes (matches `API_SECRET_KEY` in `.env`)
- CORS restricted to `ALLOWED_ORIGINS`
- 50MB file size limit
- Rate limiting: 200 req/hr, 20 req/min per IP
- `debug=False` in production

---

## Currency Display

All monetary values in JSX use the `<FormattedCurrency>` component:
- **AED**: renders inline UAE Dirham SVG symbol (`DirhamSymbol.tsx`) + number
- **Other currencies**: standard `Intl.NumberFormat` text output
- String contexts (chart tooltips, CSV export): `formatAmount()` returns plain text like "AED 1,234"
- SVG symbol uses `fill="currentColor"` — inherits green/red/muted CSS color automatically

---

## UAE-Specific Context

| Item | Detail |
|------|--------|
| **VAT** | 5% (Federal Law No.8 of 2017, effective Jan 2018) |
| **Fiscal year** | Jan 1 – Dec 31 |
| **Date format** | DD/MM/YYYY (UAE banks) vs MM/DD/YYYY (US banks) — auto-detected |
| **Currency** | AED (UAE Dirham) |
| **Salary system** | WPS (Wages Protection System) — mandatory |
| **Common transfers** | IBFT (Instant Bank Fund Transfer), MOBN (Mobile Banking), CCDM (Cash & Cheque Deposit Machine) |
| **UAE banks** | ADCB, FAB, ENBD, Mashreq, CBD, HSBC ME, RAKBANK, ADIB |
| **Common merchants** | DEWA (utilities), Etisalat/e& (telecom), SALIK (toll), RTA (transport), ADNOC/ENOC (fuel), Talabat/Deliveroo (food delivery) |

---

## Key Design Decisions

1. **Transactions as source of truth** — All financial figures (P&L, Financials, Budget spending) read from the `transactions` table, not derived `bills`/`invoices` tables. This ensures consistency with the Home page.

2. **Vendor-name-first category resolution** — `guessCategory(vendorName)` runs BEFORE trusting stored DB category. Prevents wrong stored categories (e.g. "Technology" for Amazon) from persisting.

3. **Batch sync** — `syncBankDataToBusinessRecords` uses bulk upserts (~6 DB calls) instead of per-row inserts (~200+ calls). Chunked at 500 rows.

4. **Supabase RLS** — Every query includes `.eq("user_id", user.id)`. All upsert payloads include `user_id` field. Without it, Supabase returns 403.

5. **Date picker stability** — `EnhancedDateRangePicker` keys use stable strings (`"initialized"` / `"default"`) not date values — prevents component remounting on every date change.

6. **Independent date ranges per tab** — P&L tab and P&L Detail tab each have their own `dateRange` state and `useEffect` for auto-detection, independent from the global Financials date range.

---

## Known Limitations

| Issue | Location | Fix Required |
|-------|----------|-------------|
| No unique constraint on `budgets(user_id, category)` | Supabase | SQL migration |
| `accounts` and `bank_accounts` are duplicate tables | DB schema | Architecture decision |
| Admin Activity Log tab is a stub | Settings.tsx | Not yet implemented |
| Analytics.tsx uses stored AI data, not live transactions | Analytics.tsx | Design decision |
| Backend service reads from `emerabooks/backend` dir | systemd service | Service file update |
