import React from "react";
import { Link } from "wouter";
import { MapPin, Briefcase, Building } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Job } from "@/types/index";

interface JobCardProps {
  job: Job;
}

const JobCard: React.FC<JobCardProps> = ({ job }) => {
  return (
    <Card className="h-full flex flex-col transition-all duration-200 hover:shadow-md">
      <CardContent className="pt-6 pb-2 flex-grow">
        <div className="mb-3">
          <Badge variant="outline" className="bg-primary/10 text-primary font-medium px-3 py-1">
            {job.clientName || "Company"}
          </Badge>
        </div>
        
        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{job.title}</h3>
        
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
          {(job.city || job.state) && (
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{[job.city, job.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
          
          {job.jobType && (
            <div className="flex items-center">
              <Briefcase className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{job.jobType}</span>
            </div>
          )}
          
          {job.clientName && (
            <div className="flex items-center">
              <Building className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{job.clientName}</span>
            </div>
          )}
        </div>
        
        {job.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3">
            {job.description.replace(/<[^>]*>/g, '').substring(0, 150)}
            {job.description.length > 150 ? '...' : ''}
          </p>
        )}
      </CardContent>
      
      <CardFooter className="pt-4 pb-6">
        <Link href={`/careers/jobs/${job.id}`}>
          <Button className="w-full">View Job</Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default JobCard;