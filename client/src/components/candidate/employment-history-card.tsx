import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, BriefcaseIcon, Building2Icon } from "lucide-react";

interface EmploymentHistoryCardProps {
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
}

/**
 * Employment History Card component that displays client history extracted from the resume
 * This component uses the OpenAI-extracted data arrays (clientNames, jobTitles, relevantDates)
 */
const EmploymentHistoryCard: React.FC<EmploymentHistoryCardProps> = ({ 
  clientNames = [], 
  jobTitles = [], 
  relevantDates = [] 
}) => {
  const hasData = clientNames.length > 0 || jobTitles.length > 0;
  
  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employment History</CardTitle>
          <CardDescription>Client history and professional positions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4">No employment history data available</p>
        </CardContent>
      </Card>
    );
  }

  // Determine the maximum number of entries across the arrays
  const maxEntries = Math.max(clientNames.length, jobTitles.length, relevantDates.length);
  
  // Create a combined array of employment history entries
  const employmentHistory = Array.from({ length: maxEntries }, (_, index) => ({
    company: clientNames[index] || "Unknown Company",
    title: jobTitles[index] || "Unknown Position",
    dateRange: relevantDates[index] || "Unknown Period"
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment History</CardTitle>
        <CardDescription>Client history and professional positions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {employmentHistory.map((entry, index) => (
            <div 
              key={index} 
              className="relative pl-5 before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-[calc(100%-8px)] before:bg-primary/20 before:rounded-full"
            >
              <div className="mb-2">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <h3 className="text-lg font-semibold text-primary">{entry.title}</h3>
                  <Badge variant="outline" className="bg-primary/10 whitespace-nowrap">
                    {entry.dateRange}
                  </Badge>
                </div>
                <p className="text-base text-muted-foreground flex items-center gap-1 mt-1">
                  <BuildingIcon size={16} className="text-muted-foreground opacity-70" />
                  {entry.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmploymentHistoryCard;