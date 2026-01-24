import { FileText, Receipt, Plus, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const QuickActionsGrid = () => {
  const navigate = useNavigate();

  const actions = [
    {
      title: "New Invoice",
      description: "Create and send invoice",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      onClick: () => navigate('/invoices')
    },
    {
      title: "Record Bill",
      description: "Add new expense",
      icon: Receipt,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      onClick: () => navigate('/bills')
    },
    {
      title: "Add Transaction",
      description: "Manual entry",
      icon: Plus,
      color: "text-green-600",
      bgColor: "bg-green-50",
      onClick: () => navigate('/banks')
    },
    {
      title: "Run Report",
      description: "Financial reports",
      icon: BarChart3,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      onClick: () => navigate('/reports')
    }
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Card
          key={action.title}
          className="p-6 hover:shadow-orange transition-all cursor-pointer group"
          onClick={action.onClick}
        >
          <div className={`w-12 h-12 rounded-lg ${action.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
            <action.icon className={`w-6 h-6 ${action.color}`} />
          </div>
          <h3 className="font-semibold text-foreground mb-1">{action.title}</h3>
          <p className="text-sm text-muted-foreground">{action.description}</p>
        </Card>
      ))}
    </div>
  );
};

export default QuickActionsGrid;
