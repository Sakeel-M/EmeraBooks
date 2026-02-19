import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertTriangle, TrendingUp, Target } from "lucide-react";
import { AnalysisData } from "@/pages/Index";

interface InsightsPanelProps {
  analysisData: AnalysisData;
}

const InsightsPanel = ({ analysisData }: InsightsPanelProps) => {
  const { ai_analysis } = analysisData;

  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">AI Insights</h3>
        </div>
        <div className="space-y-3">
          {ai_analysis.ai_insights?.key_insights?.slice(0, 4).map((insight: string, index: number) => (
            <div key={index} className="p-3 bg-secondary rounded-lg">
              <p className="text-sm text-secondary-foreground">{insight}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Risk Alerts */}
      {ai_analysis.risk_management?.alerts && ai_analysis.risk_management.alerts.length > 0 && (
        <Card className="p-6 border-destructive/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="text-lg font-semibold text-foreground">Risk Alerts</h3>
          </div>
          <div className="space-y-2">
            {ai_analysis.risk_management.alerts.map((alert: string, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <Badge variant="destructive" className="mt-1">!</Badge>
                <p className="text-sm text-foreground">{alert}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Smart Recommendations</h3>
        </div>
        <div className="space-y-3">
          {ai_analysis.smart_recommendations?.savings_strategy?.slice(0, 4).map((rec: string, index: number) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary-foreground">{index + 1}</span>
              </div>
              <p className="text-sm text-foreground">{rec}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Action Plan */}
      {ai_analysis.smart_recommendations?.action_plan && (
        <Card className="p-6 bg-gradient-primary">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary-foreground" />
            <h3 className="text-lg font-semibold text-primary-foreground">Action Plan</h3>
          </div>
          <div className="space-y-2">
            {ai_analysis.smart_recommendations.action_plan.slice(0, 3).map((action: string, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary-foreground">✓</span>
                </div>
                <p className="text-sm text-primary-foreground">{action}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default InsightsPanel;
