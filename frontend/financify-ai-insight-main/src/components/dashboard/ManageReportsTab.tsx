import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, FileText, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { database, type UploadedFile } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ManageReportsTabProps {
  files: UploadedFile[];
  currentFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
}

const ManageReportsTab = ({ files, currentFileId, onSelectFile, onDeleteFile }: ManageReportsTabProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await database.deleteFile(fileId);
      onDeleteFile(fileId);
      // Invalidate all related caches so sidebar pages update immediately
      queryClient.invalidateQueries();
      toast({ title: "Report deleted", description: "The report and all its related data have been removed." });
    } catch (err: any) {
      const message = err?.message || "Could not delete the report.";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  if (files.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Reports Uploaded</h3>
        <p className="text-muted-foreground">Upload a bank statement to get started.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Uploaded Reports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {files.map((file) => (
          <div
            key={file.id}
            className={`flex items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${
              file.id === currentFileId ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => onSelectFile(file.id)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{file.file_name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{file.bank_name}</Badge>
                  <Badge variant="outline" className="text-xs">{file.currency}</Badge>
                  <span className="text-xs text-muted-foreground">{file.total_transactions} txns</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(file.id);
              }}
              disabled={deletingId === file.id}
            >
              {deletingId === file.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        ))}
      </CardContent>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete Report"
        description="This will permanently delete the report, its transactions, and analysis data. This action cannot be undone."
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        variant="destructive"
      />
    </Card>
  );
};

export default ManageReportsTab;
