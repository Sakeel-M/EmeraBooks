import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Database, Loader2, FileText } from "lucide-react";

interface UploadedFile {
  id: string;
  file_name: string;
  bank_name: string;
  total_transactions: number;
  created_at: string;
}

interface DataPreviewProps {
  bankCount: number;
  odooCount: number;
  uploadedFiles?: UploadedFile[];
  selectedFileId?: string | null;
  onFileSelect?: (fileId: string) => void;
  isLoading?: boolean;
}

export function DataPreview({ 
  bankCount, 
  odooCount,
  uploadedFiles = [],
  selectedFileId,
  onFileSelect,
  isLoading = false
}: DataPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Data Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Selector */}
        {uploadedFiles.length > 0 && onFileSelect && (
          <div className="space-y-2">
            <Label>Select Bank Statement</Label>
            <Select value={selectedFileId || ""} onValueChange={onFileSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an uploaded file..." />
              </SelectTrigger>
              <SelectContent>
                {uploadedFiles.map((file) => (
                  <SelectItem key={file.id} value={file.id}>
                    {file.file_name} • {file.bank_name} ({file.total_transactions} transactions)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {uploadedFiles.length === 0 && onFileSelect && (
          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
            No bank statements uploaded yet. Please upload a bank statement file first.
          </div>
        )}

        {/* Transaction Counts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">Bank Transactions</span>
            </div>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-green-600" />
            ) : (
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{bankCount}</p>
            )}
          </div>
          
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">Odoo Transactions</span>
            </div>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{odooCount}</p>
            {!odooCount && (
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Will be fetched during reconciliation
              </p>
            )}
          </div>
        </div>

        {selectedFileId && bankCount > 0 && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
            ✓ Ready to reconcile {bankCount} bank transactions
          </div>
        )}
      </CardContent>
    </Card>
  );
}
