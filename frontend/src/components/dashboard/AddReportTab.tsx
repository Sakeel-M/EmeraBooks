import { Upload, PieChart, Lightbulb, AlertTriangle, FolderOpen } from "lucide-react";
import FileUpload from "@/components/FileUpload";

interface AddReportTabProps {
  onUploadSuccess: (data: any) => void;
  existingFiles?: Array<{ file_name: string; bank_name?: string | null; currency?: string | null }>;
  onManageReports?: () => void;
}

const AddReportTab = ({ onUploadSuccess, existingFiles = [], onManageReports }: AddReportTabProps) => {

  // Group existing files by currency for a concise summary
  const currencySummary = existingFiles.reduce<Record<string, string[]>>((acc, f) => {
    const cur = f.currency || "Unknown";
    if (!acc[cur]) acc[cur] = [];
    acc[cur].push(f.bank_name || f.file_name);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto">
      {/* Existing reports warning */}
      {existingFiles.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg mb-5 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {existingFiles.length} existing report{existingFiles.length !== 1 ? "s" : ""} already uploaded
            </p>
            <p className="text-xs mt-1 opacity-90">
              {Object.entries(currencySummary).map(([cur, banks]) =>
                `${cur}: ${banks.slice(0, 2).join(", ")}${banks.length > 2 ? ` +${banks.length - 2} more` : ""}`
              ).join(" · ")}
            </p>
            <p className="text-xs mt-1.5 opacity-80">
              Uploading a new report will <strong>add</strong> its data alongside existing ones. Mixed currencies will each display in their own currency. To replace a report, delete it from Manage Reports first.
            </p>
            {onManageReports && (
              <button
                onClick={onManageReports}
                className="mt-2 flex items-center gap-1 text-xs font-medium underline underline-offset-2 opacity-90 hover:opacity-100"
              >
                <FolderOpen className="w-3 h-3" /> Go to Manage Reports
              </button>
            )}
          </div>
        </div>
      )}

      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary shadow-lg mb-4">
          <Upload className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Upload Your Bank Statement</h2>
        <p className="text-muted-foreground">Get AI-powered insights into your spending patterns</p>
      </div>

      {/* Upload is never hard-disabled by health check — the error toast on failure is enough */}
      <FileUpload onUploadSuccess={onUploadSuccess} />

      <div className="mt-10 grid md:grid-cols-3 gap-4">
        {[
          { icon: PieChart, title: "Smart Analysis", desc: "AI analyzes spending patterns and trends" },
          { icon: Lightbulb, title: "Personalized Tips", desc: "Get recommendations to save money" },
          { icon: AlertTriangle, title: "Risk Alerts", desc: "Detect unusual spending patterns" },
        ].map((item) => (
          <div key={item.title} className="text-center p-5 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-secondary mx-auto mb-3 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddReportTab;
