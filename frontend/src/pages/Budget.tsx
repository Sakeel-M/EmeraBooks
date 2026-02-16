import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { database } from "@/lib/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, AlertCircle, CheckCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Budget = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [file, setFile] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedBudgets = await database.getBudgets();
        setBudgets(savedBudgets);

        const currentFileId = database.getCurrentFile();
        if (currentFileId) {
          const fileData = await database.getFileById(currentFileId);
          const analysisData = await database.getAnalysisByFileId(currentFileId);
          setFile(fileData);
          setAnalysis(analysisData);
        }
      } catch (error) {
        console.error("Error loading budget data:", error);
        toast({
          title: "Error",
          description: "Failed to load budget data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  const saveBudgets = async () => {
    try {
      const currency = file?.currency || "USD";
      await database.saveBudgets(budgets, currency);
      toast({
        title: "Budgets Saved",
        description: "Your budget allocations have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving budgets:", error);
      toast({
        title: "Error",
        description: "Failed to save budgets. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
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

  if (!file || !analysis) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4 max-w-md">
            <Target className="w-16 h-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">No Data Available</h2>
            <p className="text-muted-foreground">
              Upload and analyze a bank statement to start tracking your budget by category.
            </p>
            <Button onClick={() => navigate("/")}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const categorySpending: Record<string, number> = analysis.ai_analysis?.spending_by_category || {};
  const categories = Object.keys(categorySpending);

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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Budget Planning</h1>
            <p className="text-muted-foreground">Set and track your spending limits</p>
          </div>
          <Button onClick={saveBudgets}>
            <Save className="w-4 h-4 mr-2" />
            Save Budgets
          </Button>
        </div>

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
                  {file.currency} {totalBudget.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className={`text-2xl font-bold ${totalProgress >= 90 ? "text-destructive" : "text-foreground"}`}>
                  {file.currency} {totalSpent.toLocaleString()}
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
                          Spent: {file.currency} {spent.toLocaleString()}
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
                        {file.currency}
                      </span>
                    </div>
                  </div>

                  {budget > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Remaining: {file.currency}{" "}
                          {Math.max(0, budget - spent).toLocaleString()}
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
      </div>
    </Layout>
  );
};

export default Budget;
