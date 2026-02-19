
# Admin: Full User Dashboard View (Real Dashboard Experience)

## What the User Wants

Currently clicking the eye icon shows a simplified table-only view (image 1). The admin wants to see the **actual full dashboard** — with the green sidebar, metric cards, quarter navigator, and all tabs (Overview, Trends, Expenses, Revenue, Transactions, AI Insights) — but loaded with the target user's data (image 2).

## Approach

The `Index.tsx` dashboard is self-contained and loads data using `database.*` functions that always query via RLS for the current user. We cannot simply reuse it for a different user's data without significant refactoring of every data function.

The cleanest approach is to **rebuild the `AdminUserDashboard` page to look and feel exactly like the real dashboard** — same Layout with sidebar, same MetricCards, same tabs with the same chart components — but feed it data fetched from the admin edge function (which already returns transactions, files, analysis data, etc.).

This means the AdminUserDashboard becomes a **data-driven wrapper** that passes the user's data into the same components that `Index.tsx` uses, giving the admin the identical visual experience.

## What Needs to Change

### 1. Extend Edge Function — Fetch Analysis Data
The `get_user_data` action currently doesn't return `analysis_results`. We need to add this so the admin can see the Overview charts and AI Insights tab just like the real dashboard.

Add to the edge function:
```typescript
adminClient.from("analysis_results")
  .select("ai_analysis, basic_statistics, data_overview, file_id")
  .eq("user_id", targetUserId)
  .order("created_at", { ascending: false })
  .limit(1)
```

### 2. Rewrite `AdminUserDashboard.tsx`

Transform it from a plain table page into a **full dashboard experience**:

- Use `<Layout>` (same component as `Index.tsx`) — this gives the exact same sidebar, header, and layout
- Show the amber "Admin View" banner inside the Layout, above the content
- Display the exact same `<MetricCards>` component with the user's calculated metrics
- Display the exact same `<QuarterNavigator>` for date filtering (but read-only, no re-analyze or export)
- Display all the same tabs: Overview, Trends, Expenses, Revenue, Transactions, AI Insights
- Pass the fetched transactions through the same `useMemo` date filter logic
- Show the user's name/email in a banner at the top (not the admin's own name in the sidebar)

### Visual Layout After Fix

```
┌────────────────────────────────────────────────────────────┐
│ [EMARA Sidebar - same green sidebar as real app]           │
│  Home                 │  ⚠️ Admin View — Viewing: Mohamed Sakeel   │
│  Banks & Cards        │  sakeel@socialeagle.ai  ← Back to Admin   │
│  Bills                │                                            │
│  Invoices             │  [Year] [Quarter] [Custom]  < 2026 >      │
│  Vendors              │                                            │
│  Customers            │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  ...                  │  │AED 55,113│ │AED 54,910│ │ AED 203  │  │
│                       │  │ Income   │ │ Expenses │ │  Profit  │  │
│  Mohamed Sakeel M     │  └──────────┘ └──────────┘ └──────────┘  │
│  (admin user shown)   │                                            │
│                       │  Overview | Trends | Expenses | Revenue   │
│                       │  Transactions | AI Insights               │
│                       │                                            │
│                       │  [Full charts and tables - real data]     │
└────────────────────────────────────────────────────────────────────┘
```

### Key Difference from Current
- **Current**: Custom standalone layout, plain table rows, no charts
- **After**: Uses the real `<Layout>` component with sidebar, same metric cards, same chart tabs as the real user dashboard

### Data Flow

```
Admin clicks Eye icon → /admin/user/:userId
  ↓
AdminUserDashboard mounts
  ↓
Calls admin-users edge function → gets transactions, files, analysis
  ↓
Converts data to same format as Index.tsx (Transaction[], AnalysisData)
  ↓
Renders <Layout> + amber banner + MetricCards + Tabs with all chart components
  ↓
Admin sees identical dashboard to what the user sees
```

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/admin-users/index.ts` | Add `analysis_results` to `get_user_data` response |
| `src/pages/AdminUserDashboard.tsx` | Full rewrite — use Layout, MetricCards, QuarterNavigator, and all dashboard tab components |

## Important Notes

- The sidebar will still show the **admin's own** profile at the bottom (since auth is the admin's session) — this is correct and expected behavior for an impersonation view
- The amber "Admin View" banner clearly communicates to the admin they are in an impersonation mode
- The `MetricDetailSheet` click-to-expand functionality will also work since we're reusing the same components
- No write actions are possible since the edge function data is read-only
- The "Re-analyze" and "Export" and "Add Report" buttons will be hidden (admin is in read-only view mode)
- The `QuarterNavigator` will still work for filtering the fetched transactions client-side

## Scope

- 1 updated edge function: add `analysis_results` fetch (5 lines)
- 1 rewritten page: `AdminUserDashboard.tsx` — transforms from simple table to full dashboard (replaces ~410 lines with ~250 lines using shared components)
