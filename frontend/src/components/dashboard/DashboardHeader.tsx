import { RefreshCw, Download, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  totalTransactions: number;
  onReanalyze: () => void;
  onExport: () => void;
  isAnalyzing: boolean;
}

const DashboardHeader = ({ totalTransactions, onReanalyze, onExport, isAnalyzing }: DashboardHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Analyzing {totalTransactions} transactions from your uploaded data
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onReanalyze} disabled={isAnalyzing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isAnalyzing ? "animate-spin" : ""}`} />
          Re-analyze
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;
