import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { database } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, AlertCircle, CheckCircle, Save } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { EnhancedDateRangePicker } from "@/components/shared/EnhancedDateRangePicker";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { formatAmount } from "@/lib/utils";

const Budget = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [categorySpending, setCategorySpending] = useState<Record<string, number>>({});
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

  useEffect(() => {
    loadBudgets();
    // Auto-detect latest transaction month
    const detectLatestMonth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("transactions")
          .select("transaction_date")
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const latest = new Date(data[0].transaction_date);
          setDateFrom(startOfMonth(latest));
          setDateTo(endOfMonth(latest));
        }
      } catch (error) {
        console.error("Error detecting latest transaction date:", error);
      }
    };
    detectLatestMonth();
  }, []);

  useEffect(() => {
    loadSpending();
  }, [dateFrom, dateTo]);

  const loadBudgets = async () => {
    try {
      const savedBudgets = await database.getBudgets();
      setBudgets(savedBudgets);
    } catch (error) {
      console.error("Error loading budget data:", error);
    }
  };

  const loadSpending = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: txns } = await supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", user.id)
        .gte("transaction_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("transaction_date", format(dateTo, "yyyy-MM-dd"));

      const spending: Record<string, number> = {};
      if (txns) {
        for (const t of txns) {
          const cat = t.category || "Uncategorized";
          spending[cat] = (spending[cat] || 0) + Math.abs(t.amount);
        }
      }
      setCategorySpending(spending);
    } catch (error) {
      console.error("Error loading spending data:", error);
      toast({ title: "Error", description: "Failed to load spending data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveBudgets = async () => {
    try {
      await database.saveBudgets(budgets, currency);
      toast({ title: "Budgets Saved", description: "Your budget allocations have been saved successfully." });
    } catch (error) {
      console.error("Error saving budgets:", error);
      toast({ title: "Error", description: "Failed to save budgets.", variant: "destructive" });
    }
  };

  const handleDateChange = (from: Date, to: Date) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const categories = Object.keys({ ...categorySpending, ...budgets });

  const calculateProgress = (category: string) => {
    const spent = Number(categorySpending[category]) || 0;
    const budget = budgets[category] || 0;
    if (budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  const getStatusColor = (category: string) => {
    const progress = calculateProgress(category);
    if (progress >= 90) return "text-destructive";
    if (progress >= 75) return "text-orange-500";
    return "text-green-600";
  };

  const getStatusIcon = (category: string) => {
    const progress = calculateProgress(category);
    if (progress >= 90) return <AlertCircle className="w-5 h-5 text-destructive" />;
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  };

  const totalBudget = Object.values(budgets).reduce((sum, val) => sum + val, 0);
  const totalSpent = Object.values(categorySpending).reduce((sum, val) => sum + Number(val), 0);
  const totalProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  if (loading && categories.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xl font-medium text-muted-foreground">Loading budget data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Budget Planning</h1>
            <p className="text-muted-foreground">Set and track your spending limits</p>
          </div>
          <Button onClick={saveBudgets}>
            <Save className="w-4 h-4 mr-2" />
            Save Budgets
          </Button>
        </div>

        <EnhancedDateRangePicker onRangeChange={handleDateChange} defaultRange={{ from: dateFrom, to: dateTo }} />

        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Overall Budget Status
            </CardTitle>
            <CardDescription>Your total spending vs budget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatAmount(totalBudget, currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className={`text-2xl font-bold ${totalProgress >= 90 ? "text-destructive" : "text-foreground"}`}>
                  {formatAmount(totalSpent, currency)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className={getStatusColor("overall")}>{totalProgress.toFixed(1)}%</span>
              </div>
              <Progress value={totalProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {categories.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState icon={Target} title="No spending data" description="No transactions found for the selected date range. Upload a bank statement or adjust the date range." />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {categories.map((category) => {
              const spent = Number(categorySpending[category]) || 0;
              const budget = budgets[category] || 0;
              const progress = calculateProgress(category);

              return (
                <Card key={category}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(category)}
                        <div>
                          <h3 className="font-semibold text-foreground">{category}</h3>
                          <p className="text-sm text-muted-foreground">
                            Spent: {formatAmount(spent, currency)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Set budget"
                          value={budgets[category] || ""}
                          onChange={(e) =>
                            setBudgets({ ...budgets, [category]: parseFloat(e.target.value) || 0 })
                          }
                          className="w-32 text-right"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {currency}
                        </span>
                      </div>
                    </div>

                    {budget > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Remaining: {formatAmount(Math.max(0, budget - spent), currency)}
                          </span>
                          <span className={getStatusColor(category)}>{progress.toFixed(1)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        {progress >= 90 && (
                          <Badge variant="destructive" className="mt-2">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Over budget warning
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Budget;
