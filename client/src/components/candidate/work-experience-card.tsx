import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, BriefcaseIcon, CheckCircle2Icon } from "lucide-react";

interface WorkExperience {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  responsibilities?: string[];
}

interface WorkExperienceCardProps {
  workExperience?: WorkExperience[];
}

const WorkExperienceCard: React.FC<WorkExperienceCardProps> = ({ workExperience }) => {
  if (!workExperience || workExperience.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Work Experience</CardTitle>
          <CardDescription>Professional experience history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4">No structured work experience data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Experience</CardTitle>
        <CardDescription>Professional experience history</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {workExperience.map((exp, index) => (
            <div 
              key={index} 
              className="relative pl-5 before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-[calc(100%-8px)] before:bg-primary/20 before:rounded-full"
            >
              <div className="mb-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-primary">{exp.title}</h3>
                  <Badge variant="outline" className="bg-primary/10">
                    {exp.startDate && exp.endDate ? 
                      `${exp.startDate} - ${exp.endDate}` : 
                      exp.startDate ? `${exp.startDate} - Present` : ""}
                  </Badge>
                </div>
                <p className="text-base text-muted-foreground flex items-center gap-1 mb-2">
                  <BriefcaseIcon size={16} className="text-muted-foreground opacity-70" />
                  {exp.company}
                </p>
              </div>
              
              {exp.responsibilities && exp.responsibilities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Key Responsibilities:</h4>
                  <ul className="space-y-1.5 list-none ml-1">
                    {exp.responsibilities.map((responsibility, idx) => (
                      <li key={idx} className="text-sm flex gap-2">
                        <CheckCircle2Icon size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{responsibility}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkExperienceCard;