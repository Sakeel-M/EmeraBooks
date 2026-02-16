import InsightsPanel from "@/components/InsightsPanel";
import type { AnalysisData } from "@/pages/Index";

interface BasicInsightsTabProps {
  analysisData: AnalysisData;
}

const BasicInsightsTab = ({ analysisData }: BasicInsightsTabProps) => {
  return <InsightsPanel analysisData={analysisData} />;
};

export default BasicInsightsTab;
