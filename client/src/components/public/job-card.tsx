import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building, Calendar } from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";

interface JobCardProps {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  type: string | null;
  postedDate: string;
}

export default function JobCard({
  id,
  title,
  company,
  location,
  type,
  postedDate
}: JobCardProps) {
  // Format the posted date
  const formattedDate = postedDate ? formatDistanceToNow(new Date(postedDate), { addSuffix: true }) : "";
  
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">{title}</h3>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {company && (
                <div className="flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  <span>{company}</span>
                </div>
              )}
              
              {location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </div>
              )}
              
              {formattedDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Posted {formattedDate}</span>
                </div>
              )}
              
              {type && (
                <div className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  {type}
                </div>
              )}
            </div>
          </div>
          
          <Link href={`/careers/jobs/${id}`}>
            <Button className="whitespace-nowrap">View Job</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}