import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onUploadSuccess: (data: any) => void;
}

const FileUpload = ({ onUploadSuccess }: FileUploadProps) => {
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
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx, .xls) or PDF file (.pdf)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log("📤 Uploading file to backend...");
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://72.60.222.167/api'}/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Upload failed:", errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Backend processed file:", data);
      
      // Validate backend response structure
      if (!data.bank_info || !data.full_data || !Array.isArray(data.full_data)) {
        console.error("❌ Invalid backend response:", data);
        throw new Error("Failed to process file. Please try again.");
      }
      
      toast({
        title: "✓ Upload Successful!",
        description: `${data.total_rows} transactions from ${data.bank_info.bank_name} (${data.bank_info.currency})`,
        duration: 5000,
      });

      onUploadSuccess(data);
    } catch (error: any) {
      console.error("❌ Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Could not process your file. Please check the format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-border hover:border-primary transition-colors">
      <div
        className={`p-12 text-center ${isDragging ? 'bg-secondary' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".xlsx,.xls,.pdf"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-4">
            {isUploading ? (
              <>
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-lg font-medium text-foreground">Processing your file...</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-orange">
                  <Upload className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">
                    Drop your Excel file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                <Button size="lg" className="mt-4">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Select File
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports .xlsx, .xls, and .pdf files
                </p>
              </>
            )}
          </div>
        </label>
      </div>
    </Card>
  );
};

export default FileUpload;
