import { useState } from "react";
import { Upload, PieChart, Lightbulb, AlertTriangle, FileText, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import FileUpload from "@/components/FileUpload";
import { database, type UploadedFile } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface AddReportTabProps {
  onUploadSuccess: (data: any) => void;
  files?: UploadedFile[];
  currentFileId?: string | null;
  onSelectFile?: (fileId: string) => void;
  onDeleteFile?: (fileId: string) => void;
}

const AddReportTab = ({ onUploadSuccess, files = [], currentFileId, onSelectFile, onDeleteFile }: AddReportTabProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await database.deleteFile(fileId);
      onDeleteFile?.(fileId);
      queryClient.invalidateQueries();
      toast({ title: "Report deleted", description: "The report and all its related data have been removed." });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message || "Could not delete the report.", variant: "destructive" });
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const uploadSection = (
    <div className="space-y-6">
      <FileUpload onUploadSuccess={onUploadSuccess} />
      <div className="grid grid-cols-3 gap-4">
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

  const statementsSection = files.length > 0 && (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Uploaded Statements ({files.length})
      </h3>
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className={`flex items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${
              file.id === currentFileId ? "border-primary bg-primary/5" : "border-border"
            }`}
            onClick={() => onSelectFile?.(file.id)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{file.file_name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {file.bank_name && <Badge variant="secondary" className="text-xs">{file.bank_name}</Badge>}
                  {file.currency && <Badge variant="outline" className="text-xs">{file.currency}</Badge>}
                  <span className="text-xs text-muted-foreground">{file.total_transactions} txns</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                  {file.id === currentFileId && (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Active</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(file.id); }}
              disabled={deletingId === file.id}
            >
              {deletingId === file.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className={files.length > 0 ? "grid grid-cols-[300px_1fr] gap-8 items-start" : "max-w-2xl mx-auto"}>
        {/* Left: Uploaded Statements (only when files exist) */}
        {files.length > 0 && <div>{statementsSection}</div>}

        {/* Right (or centered): Upload area + feature cards */}
        <div>{uploadSection}</div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete Report"
        description="This will permanently delete the report, its transactions, and analysis data. This action cannot be undone."
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        variant="destructive"
      />
    </>
  );
};

export default AddReportTab;
