import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Calculator, BookOpen, FileText } from "lucide-react";

export default function Accounting() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Accounting</h1>
            <p className="text-muted-foreground">Manage chart of accounts and journal entries</p>
          </div>
        </div>

        <Tabs defaultValue="coa" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
            <TabsTrigger value="journal">Journal Entries</TabsTrigger>
            <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          </TabsList>

          <TabsContent value="coa" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  icon={Calculator}
                  title="Chart of Accounts"
                  description="Set up your chart of accounts to track assets, liabilities, equity, revenue, and expenses. This feature helps organize all financial transactions."
                />
                <div className="flex justify-center mt-6">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journal" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  icon={BookOpen}
                  title="Journal Entries"
                  description="Create double-entry journal entries to record financial transactions. Each entry must have balanced debits and credits."
                />
                <div className="flex justify-center mt-6">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Journal Entry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trial" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  icon={FileText}
                  title="Trial Balance"
                  description="View a summary of all account balances to ensure debits equal credits. The trial balance is the foundation for financial statements."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
