import { Layout } from "@/components/layout/Layout";
import { database } from "@/lib/database";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";

const Analytics = () => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      const currentFileId = database.getCurrentFile();
      if (currentFileId) {
        const fileData = await database.getFileById(currentFileId);
        const analysisData = await database.getAnalysisByFileId(currentFileId);

        if (fileData && analysisData) {
          setFile(fileData);
          setAnalysis(analysisData);
        }
      }
      setLoading(false);
    };

    loadAnalysis();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xl font-medium text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!file || !analysis) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <p className="text-xl font-medium text-muted-foreground">No analytics available</p>
            <p className="text-sm text-muted-foreground">Please upload and analyze a file first</p>
          </div>
        </div>
      </Layout>
    );
  }

  const monthlyData = Object.entries(analysis.ai_analysis?.monthly_trends || {}).map(
    ([month, amount]) => ({
      month,
      spending: amount,
    })
  );

  const categoryData = Object.entries(analysis.ai_analysis?.spending_by_category || {})
    .map(([name, amount]) => ({
      name,
      value: amount as number,
    }))
    .sort((a, b) => b.value - a.value);

  const cumulativeData = monthlyData.map((item, index) => ({
    month: item.month,
    cumulative: monthlyData.slice(0, index + 1).reduce((sum, m) => sum + (m.spending as number), 0),
  }));

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Advanced Analytics</h1>
          <p className="text-muted-foreground">Deep insights into your spending patterns</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg Monthly Spending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {file.currency}{" "}
                {(
                  monthlyData.reduce((sum, m) => sum + (m.spending as number), 0) / monthlyData.length || 0
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{categoryData.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Spending Trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {monthlyData.length > 1 &&
                monthlyData[monthlyData.length - 1].spending >
                  monthlyData[monthlyData.length - 2].spending ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-destructive" />
                    <span className="text-2xl font-bold text-destructive">Increasing</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">Decreasing</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cumulative Spending Over Time</CardTitle>
            <CardDescription>Track your total spending accumulation</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Spending Comparison</CardTitle>
            <CardDescription>Compare spending across all categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
            <CardDescription>Line chart showing spending patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="spending"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Analytics;
