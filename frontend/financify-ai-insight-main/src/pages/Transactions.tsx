import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { database } from "@/lib/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/shared/ExportButton";
import { Search, ArrowUpDown, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Transactions = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 20;

  useEffect(() => {
    const loadTransactions = async () => {
      const currentFileId = database.getCurrentFile();
      if (currentFileId) {
        const fileData = await database.getFileById(currentFileId);
        const transactions = await database.getTransactionsByFileId(currentFileId);
        
        const transformedData = transactions.map(t => ({
          Date: t.transaction_date,
          Description: t.description,
          Category: t.category,
          Amount: parseFloat(t.amount.toString()),
        }));

        setAllTransactions(transformedData);
        setFile(fileData);
      }
      setLoading(false);
    };

    loadTransactions();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(allTransactions.map((t: any) => t.Category));
    return Array.from(cats).filter(Boolean);
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    if (searchQuery) {
      filtered = filtered.filter((t: any) =>
        t.Description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((t: any) => t.Category === categoryFilter);
    }

    filtered.sort((a: any, b: any) => {
      const dateA = new Date(a.Date).getTime();
      const dateB = new Date(b.Date).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [allTransactions, searchQuery, categoryFilter, sortOrder]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Food: "bg-orange-100 text-orange-700",
      Transport: "bg-blue-100 text-blue-700",
      Shopping: "bg-purple-100 text-purple-700",
      Entertainment: "bg-pink-100 text-pink-700",
      Bills: "bg-red-100 text-red-700",
      Healthcare: "bg-green-100 text-green-700",
      Other: "bg-gray-100 text-gray-700",
    };
    return colors[category] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xl font-medium text-muted-foreground">Loading transactions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!file) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <p className="text-xl font-medium text-muted-foreground">No data available</p>
            <p className="text-sm text-muted-foreground">Please upload a file first</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">All Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all your transactions ({filteredTransactions.length} total)
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Filter and search through your transactions</CardDescription>
              </div>
              <ExportButton data={filteredTransactions} filename="transactions" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                {sortOrder === "asc" ? "Oldest" : "Newest"}
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedTransactions.map((transaction: any, index: number) => (
                      <tr key={index} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 text-sm">{transaction.Date}</td>
                        <td className="py-3 px-4 text-sm">{transaction.Description}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className={getCategoryColor(transaction.Category)}>
                            {transaction.Category}
                          </Badge>
                        </td>
                        <td
                          className={`py-3 px-4 text-sm text-right font-medium ${
                            parseFloat(transaction.Amount) < 0 ? "text-destructive" : "text-green-600"
                          }`}
                        >
                          {file.currency}{" "}
                          {Math.abs(parseFloat(transaction.Amount)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of{" "}
                  {filteredTransactions.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Transactions;
