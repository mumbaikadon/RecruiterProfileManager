import React from "react";
import { Badge } from "@/components/ui/badge";
import { BriefcaseIcon, CheckCircle2Icon } from "lucide-react";

interface ExperienceItemProps {
  experience: {
    company: string;
    title?: string;
    position?: string;
    startDate?: string;
    endDate?: string;
    dates?: string;
    responsibilities?: string[];
  };
}

const ExperienceItem: React.FC<ExperienceItemProps> = ({ experience }) => {
  // Support both 'title' and 'position' fields for flexibility
  const jobTitle = experience.title || experience.position || "Unknown Position";
  
  // Support both date formats (startDate/endDate or dates)
  const displayDates = experience.dates || 
    (experience.startDate && experience.endDate ? 
      `${experience.startDate} - ${experience.endDate}` : 
      experience.startDate ? `${experience.startDate} - Present` : "");
  
  return (
    <div className="relative pl-5 before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-[calc(100%-8px)] before:bg-primary/20 before:rounded-full">
      <div className="mb-2">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-primary">{jobTitle}</h3>
          {displayDates && (
            <Badge variant="outline" className="bg-primary/10">
              {displayDates}
            </Badge>
          )}
        </div>
        <p className="text-base text-muted-foreground flex items-center gap-1 mb-2">
          <BriefcaseIcon size={16} className="text-muted-foreground opacity-70" />
          {experience.company}
        </p>
      </div>
      
      {experience.responsibilities && experience.responsibilities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Responsibilities:</h4>
          <ul className="space-y-1.5 list-none ml-1">
            {experience.responsibilities.map((responsibility, idx) => (
              <li key={idx} className="text-sm flex gap-2">
                <CheckCircle2Icon size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                <span>{responsibility}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExperienceItem;