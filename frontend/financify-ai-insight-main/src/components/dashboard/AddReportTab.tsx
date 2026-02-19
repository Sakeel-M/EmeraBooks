import { Upload, PieChart, Lightbulb, AlertTriangle } from "lucide-react";
import FileUpload from "@/components/FileUpload";

interface AddReportTabProps {
  onUploadSuccess: (data: any) => void;
}

const AddReportTab = ({ onUploadSuccess }: AddReportTabProps) => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary shadow-lg mb-4">
          <Upload className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Upload Your Bank Statement</h2>
        <p className="text-muted-foreground">Get AI-powered insights into your spending patterns</p>
      </div>

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
