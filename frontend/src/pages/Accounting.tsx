import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartOfAccountsTab } from "@/components/accounting/ChartOfAccountsTab";
import { JournalEntriesTab } from "@/components/accounting/JournalEntriesTab";
import { TrialBalanceTab } from "@/components/accounting/TrialBalanceTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, BookOpen, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAllRows } from "@/lib/fetchAllRows";

function StatCard({ title, value, sub, icon: Icon }: { title: string; value: string; sub?: string; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Accounting() {
  const { data: stats } = useQuery({
    queryKey: ["accounting-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [{ count: accountCount }, { data: lastEntry }] = await Promise.all([
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("is_active", true).eq("user_id", user.id),
        supabase.from("journal_entries").select("entry_date").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(1),
      ]);

      const allEntries = await fetchAllRows(
        supabase.from("journal_entries").select("id").eq("user_id", user.id)
      );

      // Check if trial balance is balanced (paginated to bypass 1000-row limit)
      let isBalanced = true;
      if (allEntries && allEntries.length > 0) {
        const ids = allEntries.map(e => e.id);
        let totalDebit = 0;
        let totalCredit = 0;
        for (let i = 0; i < ids.length; i += 200) {
          const batch = ids.slice(i, i + 200);
          const lines = await fetchAllRows(
            supabase
              .from("journal_entry_lines")
              .select("debit_amount, credit_amount")
              .in("journal_entry_id", batch)
          );
          for (const l of lines as any[]) {
            totalDebit += l.debit_amount || 0;
            totalCredit += l.credit_amount || 0;
          }
        }
        isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
      }

      return {
        accountCount: accountCount || 0,
        entryCount: allEntries?.length || 0,
        lastEntryDate: lastEntry?.[0]?.entry_date ? format(new Date(lastEntry[0].entry_date), "MMM d, yyyy") : "—",
        isBalanced,
      };
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Accounting</h1>
          <p className="text-muted-foreground">Manage chart of accounts, journal entries, and trial balance</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Accounts"
            value={String(stats?.accountCount ?? "—")}
            sub="Active accounts"
            icon={Calculator}
          />
          <StatCard
            title="Journal Entries"
            value={String(stats?.entryCount ?? "—")}
            sub="All time"
            icon={BookOpen}
          />
          <StatCard
            title="Last Entry"
            value={stats?.lastEntryDate ?? "—"}
            sub="Most recent entry date"
            icon={Calendar}
          />
          <StatCard
            title="Trial Balance"
            value={stats?.entryCount === 0 ? "No entries" : stats?.isBalanced ? "Balanced" : "Unbalanced"}
            sub={stats?.isBalanced ? "All debits = credits" : "Review journal entries"}
            icon={stats?.isBalanced ? CheckCircle : AlertTriangle}
          />
        </div>

        <Tabs defaultValue="coa" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
            <TabsTrigger value="journal">Journal Entries</TabsTrigger>
            <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          </TabsList>

          <TabsContent value="coa"><ChartOfAccountsTab /></TabsContent>
          <TabsContent value="journal"><JournalEntriesTab /></TabsContent>
          <TabsContent value="trial"><TrialBalanceTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
