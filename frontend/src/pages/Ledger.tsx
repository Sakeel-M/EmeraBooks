import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, FileText, GitCompareArrows } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { CashLedgerTab } from "./CashLiquidity";
import { JournalEntriesTab } from "@/components/ledger/JournalEntriesTab";
import { DoubleEntriesTab } from "@/components/ledger/DoubleEntriesTab";

export default function Ledger() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Ledger
          </h1>
          <p className="text-muted-foreground">
            Every transaction grouped by category — your full cash flow at a glance
          </p>
        </div>

        <Tabs defaultValue="summary">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="summary" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Journal Entries
            </TabsTrigger>
            <TabsTrigger value="double" className="gap-1.5">
              <GitCompareArrows className="h-3.5 w-3.5" />
              Double Entries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <CashLedgerTab />
          </TabsContent>
          <TabsContent value="journal" className="mt-4">
            <JournalEntriesTab />
          </TabsContent>
          <TabsContent value="double" className="mt-4">
            <DoubleEntriesTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
