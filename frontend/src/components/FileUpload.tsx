import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface FileUploadProps {
  onUploadSuccess: (data: any) => void;
  disabled?: boolean;
}

const FileUpload = ({ onUploadSuccess, disabled = false }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.pdf'];
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
    ];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx, .xls) or PDF file (.pdf)",
        variant: "destructive",
      });
      return;
    }

    // Reject if MIME type is known but doesn't match expected types
    if (file.type && !validMimeTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "File content does not match its extension. Please upload a valid Excel or PDF file.",
        variant: "destructive",
      });
      return;
    }

    // Enforce 50 MB file size limit (matches backend)
    const MAX_SIZE_MB = 50;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Maximum file size is ${MAX_SIZE_MB} MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      console.log("📤 Uploading file to backend...");
      const data = await api.uploadFile(file);
      console.log("✅ Backend processed file:", data);

      // Validate backend response structure
      if (!data.bank_info || !data.full_data || !Array.isArray(data.full_data)) {
        console.error("❌ Invalid backend response:", data);
        throw new Error("server-invalid-response");
      }

      toast({
        title: "✓ Upload Successful!",
        description: `${data.total_rows} transactions from ${data.bank_info.bank_name} (${data.bank_info.currency})`,
        duration: 5000,
      });

      onUploadSuccess(data);
    } catch (error: any) {
      console.error("❌ Upload error:", error);

      // Distinguish network errors (TypeError: Failed to fetch) from server errors
      const isNetworkError =
        error instanceof TypeError ||
        error?.message?.toLowerCase().includes("failed to fetch") ||
        error?.message?.toLowerCase().includes("network");

      toast({
        title: "Upload Failed",
        description: isNetworkError
          ? "Cannot reach the backend server. Make sure Flask is running on port 5000, then try again."
          : error?.message?.startsWith("server-invalid-response")
          ? "The server returned an unexpected response. Please check the file format and try again."
          : `Server error: ${error?.message || "Unknown error. Please try again."}`,
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isDisabled = disabled || isUploading;

  return (
    <Card className={`border-2 border-dashed transition-colors ${isDisabled ? "border-border opacity-60 pointer-events-none" : "border-border hover:border-primary"}`}>
      <div
        className={`p-12 text-center ${isDragging ? 'bg-secondary' : ''}`}
        onDragOver={isDisabled ? undefined : handleDragOver}
        onDragLeave={isDisabled ? undefined : handleDragLeave}
        onDrop={isDisabled ? undefined : handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".xlsx,.xls,.pdf"
          onChange={handleFileSelect}
          disabled={isDisabled}
        />

        <div className="flex flex-col items-center gap-4">
          {isUploading ? (
            <>
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-foreground">Processing your file...</p>
            </>
          ) : (
            <>
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center gap-4 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-orange">
                  <Upload className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-lg font-semibold text-foreground">
                    Drop your Bank Statement here
                  </p>
                  <p className="text-sm text-muted-foreground">or click the button below to browse</p>
                </div>
              </label>
              {/* Button is outside <label> to avoid browser event-interception bug */}
              <Button
                size="lg"
                className="mt-2"
                disabled={isDisabled}
                type="button"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Select File
              </Button>
              <p className="text-xs text-muted-foreground">
                Supports .xlsx, .xls, and .pdf files
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default FileUpload;
