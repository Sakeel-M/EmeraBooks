

# Fix Admin Page and Add Sidebar with Better Design

## Problems Identifie

1. **Edge function bug**: The `admin-users` edge function uses `auth.getClaims()` which does not exist in the Supabase JS client. It should use `auth.getUser()` instead to verify the caller's identity.
2. **HTTP method mismatch**: The frontend calls `supabase.functions.invoke("admin-users")` which defaults to POST, but the edge function lists users only on GET. Need to explicitly pass `method: "GET"` or restructure to handle POST for listing too.
3. **No sidebar on Admin page**: It was removed previously and now needs to be added back -- but as part of the existing Layout wrapper, not the main navigation sidebar.
4. **Visual design needs improvement**: Stats cards and table need more polish with gradients, better spacing, and the brand palette.

## Plan

### 1. Fix the Edge Function (`supabase/functions/admin-users/index.ts`)
- Replace `auth.getClaims(token)` with `auth.getUser(token)` to extract the caller ID
- This fixes the 401 error preventing user listing

### 2. Fix Frontend API Call (`src/pages/Admin.tsx`)
- Change the query function to pass `method: "GET"` explicitly when listing users
- Or change edge function to also handle POST for listing (simpler: just make both GET and POST with no body return users list)

### 3. Wrap Admin Page in Layout (`src/pages/Admin.tsx`)
- Import and wrap content with the existing `<Layout>` component so the app sidebar appears
- Remove the standalone "Back to Dashboard" button since the sidebar provides navigation
- Keep the admin-specific header and content inside Layout

### 4. Redesign Admin Page for Better Visual Appeal
- Add gradient backgrounds on stat cards matching the brand palette (Deep Forest Green / Warm Beige)
- Add colored icons on stat cards (green for users, blue for new, amber for admins, etc.)
- Add subtle hover effects on table rows
- Improve the header area with a gradient banner
- Add a "User Management" section title above the table
- Better empty state with illustration
- Add Tabs for future sections (Users / Activity Log placeholder)

### Technical Details

**Edge function fix** (line 32):
```typescript
// BEFORE (broken):
const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
const callerId = claimsData.claims.sub;

// AFTER (working):
const { data: { user }, error: userError } = await userClient.auth.getUser();
const callerId = user?.id;
```

**Admin.tsx changes**:
- Import `Layout` from `@/components/layout/Layout`
- Wrap return in `<Layout>...</Layout>`
- Remove "Back to Dashboard" button
- Add gradient stat cards with colored icon backgrounds
- Better spacing and card hover effects

**Files to modify**:
- `supabase/functions/admin-users/index.ts` -- fix auth verification
- `src/pages/Admin.tsx` -- add Layout wrapper, improve design

