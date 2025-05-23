import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BriefcaseIcon, ClockIcon, BuildingIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { transformResumeData } from "@/lib/resume-data-transformer";

interface EmploymentRecord {
  company: string;
  title: string;
  period: string;
}

interface EmploymentHistoryCardProps {
  // Support both the original flat format and the new structured format
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  experience?: EmploymentRecord[];
  resumeData?: any; // Full resume data object
  className?: string;
}

export function EmploymentHistoryCard({
  clientNames = [],
  jobTitles = [],
  relevantDates = [],
  experience = [],
  resumeData,
  className = "",
}: EmploymentHistoryCardProps) {
  // If resumeData is provided, use our transformer to get structured data
  let employmentRecords: EmploymentRecord[] = [];
  
  if (resumeData) {
    // Use the transformer to get structured data
    const transformedData = transformResumeData(resumeData);
    employmentRecords = transformedData.experience;
  } else if (experience && experience.length > 0) {
    // If structured experience data is already provided, use it
    employmentRecords = experience;
  } else {
    // Fall back to the original implementation using separate arrays
    // Find the max length for the arrays to iterate over
    const maxLength = Math.max(
      clientNames.length,
      jobTitles.length,
      relevantDates.length
    );
    
    // Create combined employment records
    employmentRecords = Array.from({ length: maxLength }, (_, index) => ({
      company: clientNames[index] || "Unknown Company",
      title: jobTitles[index] || "Position not specified",
      period: relevantDates[index] || "Dates not specified",
    }));
  }
  
  // Determine if we have any employment history to display
  const hasEmploymentHistory = employmentRecords.length > 0;

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="bg-blue-50 dark:bg-slate-800">
        <CardTitle className="text-lg flex items-center gap-2">
          <BriefcaseIcon className="h-5 w-5" />
          Employment History
        </CardTitle>
        <CardDescription>
          Extracted from resume
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {hasEmploymentHistory ? (
          <div className="space-y-5">
            {employmentRecords.map((record, index) => (
              <div key={index} className="border-b border-slate-200 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{record.company}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-6">
                    <Badge variant="outline" className="font-normal">
                      {record.title}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-6 text-slate-500 text-sm">
                    <ClockIcon className="h-3 w-3" />
                    <span>{record.period}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500">
            <BriefcaseIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No employment history information was extracted from the resume.</p>
            <p className="text-sm mt-2">Try uploading a more detailed resume to see employment history.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}