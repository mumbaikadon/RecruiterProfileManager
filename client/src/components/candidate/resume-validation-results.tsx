import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, AlertTriangle, X } from "lucide-react";

interface ValidationResult {
  hasChanges: boolean;
  newEmployers: string[];
  removedEmployers: string[];
  changedDates: Array<{employer: string, old: string, new: string}>;
  changedTitles: Array<{employer: string, old: string, new: string}>;
  overallRisk: 'none' | 'low' | 'medium' | 'high';
}

interface ResumeValidationResultsProps {
  validationResult: ValidationResult | null;
  isLoading: boolean;
}

/**
 * Component to display the results of resume validation when resubmitting a candidate
 */
const ResumeValidationResults: React.FC<ResumeValidationResultsProps> = ({ 
  validationResult,
  isLoading 
}) => {
  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-24">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!validationResult) {
    return null;
  }

  const { 
    hasChanges, 
    newEmployers, 
    removedEmployers, 
    changedDates, 
    changedTitles,
    overallRisk
  } = validationResult;

  if (!hasChanges) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <Check className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Resume Consistent</AlertTitle>
        <AlertDescription className="text-green-700">
          No significant changes detected between previous and current resume.
        </AlertDescription>
      </Alert>
    );
  }

  // Determine the appropriate alert style based on risk level
  const alertStyles = {
    none: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", title: "Resume Updated" },
    low: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", title: "Resume Updated" },
    medium: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800", title: "Resume Changes Detected" },
    high: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", title: "Significant Resume Changes" }
  };

  const style = alertStyles[overallRisk];
  
  return (
    <div className="space-y-4">
      <Alert className={`${style.bg} ${style.border}`}>
        {overallRisk === 'high' ? (
          <AlertCircle className="h-4 w-4 text-red-600" />
        ) : overallRisk === 'medium' ? (
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        ) : (
          <Check className="h-4 w-4 text-green-600" />
        )}
        <AlertTitle className={style.text}>{style.title}</AlertTitle>
        <AlertDescription className={style.text}>
          {overallRisk === 'high' 
            ? "Major discrepancies detected between previous and current resume." 
            : overallRisk === 'medium'
              ? "Some notable changes detected in employment history."
              : "Resume has been updated with new information."}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Resume Comparison Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newEmployers.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 flex items-center">
                <Badge className="bg-green-500 mr-2">New</Badge>
                Added Employers
              </h4>
              <ul className="list-disc pl-5 text-sm">
                {newEmployers.map((employer, idx) => (
                  <li key={idx} className="text-gray-700">{employer}</li>
                ))}
              </ul>
            </div>
          )}

          {removedEmployers.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 flex items-center">
                <Badge className="bg-red-500 mr-2">Removed</Badge>
                Removed Employers
              </h4>
              <ul className="list-disc pl-5 text-sm">
                {removedEmployers.map((employer, idx) => (
                  <li key={idx} className="text-gray-700">{employer}</li>
                ))}
              </ul>
            </div>
          )}

          {changedDates.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 flex items-center">
                <Badge className="bg-yellow-500 mr-2">Changed</Badge>
                Modified Employment Dates
              </h4>
              <ul className="list-disc pl-5 text-sm">
                {changedDates.map((change, idx) => (
                  <li key={idx} className="text-gray-700">
                    <span className="font-medium">{change.employer}:</span>{" "}
                    <span className="text-red-500 line-through">{change.old}</span>{" "}
                    <X className="inline h-3 w-3" />{" "}
                    <span className="text-green-500">{change.new}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changedTitles.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 flex items-center">
                <Badge className="bg-yellow-500 mr-2">Changed</Badge>
                Modified Job Titles
              </h4>
              <ul className="list-disc pl-5 text-sm">
                {changedTitles.map((change, idx) => (
                  <li key={idx} className="text-gray-700">
                    <span className="font-medium">{change.employer}:</span>{" "}
                    <span className="text-red-500 line-through">{change.old}</span>{" "}
                    <X className="inline h-3 w-3" />{" "}
                    <span className="text-green-500">{change.new}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumeValidationResults;