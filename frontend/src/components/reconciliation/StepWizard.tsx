import { Check, Link, FileSearch, Play, ClipboardList } from "lucide-react";

interface Step {
  title: string;
  description: string;
}

interface StepWizardProps {
  currentStep: number;
  steps?: Step[];
}

const defaultSteps = [
  { number: 1, title: "Connect to Odoo", icon: Link },
  { number: 2, title: "Select Data", icon: FileSearch },
  { number: 3, title: "Run Reconciliation", icon: Play },
  { number: 4, title: "Review Results", icon: ClipboardList },
];

export function StepWizard({ currentStep, steps }: StepWizardProps) {
  const displaySteps = steps 
    ? steps.map((s, i) => ({ number: i + 1, title: s.title, description: s.description, icon: defaultSteps[i]?.icon || Link }))
    : defaultSteps.map(s => ({ ...s, description: '' }));

  return (
    <div className="flex items-center justify-between">
      {displaySteps.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        const Icon = step.icon;

        return (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`mt-2 text-sm font-medium ${
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
              {step.description && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </span>
              )}
            </div>
            {index < displaySteps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-4 ${
                  currentStep > step.number ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
