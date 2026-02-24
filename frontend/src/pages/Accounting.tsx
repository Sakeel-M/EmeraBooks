import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartOfAccountsTab } from "@/components/accounting/ChartOfAccountsTab";
import { JournalEntriesTab } from "@/components/accounting/JournalEntriesTab";
import { TrialBalanceTab } from "@/components/accounting/TrialBalanceTab";

export default function Accounting() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Accounting</h1>
          <p className="text-muted-foreground">Manage chart of accounts, journal entries, and trial balance</p>
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
