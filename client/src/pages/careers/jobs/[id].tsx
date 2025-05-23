import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, MapPin, Briefcase, Building, Calendar, FileText } from "lucide-react";
import { useJob } from "@/hooks/use-jobs";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/date-utils";
import { sanitizeHtml } from "@/lib/utils";

const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id);
  const [_, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Fetch job data
  const { data: job, isLoading, error } = useJob(jobId);
  
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto py-16">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </PublicLayout>
    );
  }
  
  if (error || !job) {
    return (
      <PublicLayout>
        <div className="container mx-auto py-16">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Job Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              We couldn't find the job you're looking for. It may have been removed or is no longer available.
            </p>
            <Button onClick={() => setLocation("/careers")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }
  
  // Job is not active, redirect to careers page
  if (job.status !== "active") {
    return (
      <PublicLayout>
        <div className="container mx-auto py-16">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-amber-600 mb-4">Job Not Available</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              This job is no longer accepting applications.
            </p>
            <Button onClick={() => setLocation("/careers")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }
  
  return (
    <PublicLayout>
      <div className="bg-primary text-white py-12">
        <div className="container mx-auto px-4">
          <Button 
            variant="ghost" 
            className="text-white mb-4 hover:bg-white/20"
            onClick={() => setLocation("/careers")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{job.title}</h1>
          
          <div className="flex flex-wrap gap-3 mt-4">
            {job.clientName && (
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 font-medium px-3 py-1">
                {job.clientName}
              </Badge>
            )}
            
            {job.jobType && (
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 font-medium px-3 py-1">
                {job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1)}
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose dark:prose-invert max-w-none" 
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }} 
                />
              </CardContent>
            </Card>
            
            {job.clientFocus && (
              <Card>
                <CardHeader>
                  <CardTitle>Client Focus Areas</CardTitle>
                  <CardDescription>Skills and experience that this client values most</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {job.clientFocus.split(',').map((focus, index) => (
                      <Badge key={index} className="mr-2 mb-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {focus.trim()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(job.city || job.state) && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {[job.city, job.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                
                {job.jobType && (
                  <div className="flex items-start space-x-3">
                    <Briefcase className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Job Type</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1)}
                      </p>
                    </div>
                  </div>
                )}
                
                {job.clientName && (
                  <div className="flex items-start space-x-3">
                    <Building className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Company</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{job.clientName}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Posted Date</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(job.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => setIsDialogOpen(true)}
                >
                  Apply Now
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Apply Now Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Apply for {job.title}</DialogTitle>
            <DialogDescription>
              Submit your application for this position at {job.clientName || "the company"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="Your first name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="Your last name" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" placeholder="(555) 123-4567" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="resume">Resume/CV</Label>
              <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4">
                <div className="flex items-center justify-center w-full">
                  <label className="w-full flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-800 text-gray-500 rounded-lg tracking-wide border border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <FileText className="w-8 h-8" />
                    <span className="mt-2 text-sm">Upload your resume (PDF, DOCX)</span>
                    <input type='file' className="hidden" accept=".pdf,.docx" />
                  </label>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="workAuthorization">Work Authorization</Label>
              <select 
                id="workAuthorization" 
                className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
              >
                <option value="">Select your work authorization</option>
                <option value="US Citizen">US Citizen</option>
                <option value="Green Card">Green Card</option>
                <option value="H1B">H1B Visa</option>
                <option value="EAD">EAD</option>
                <option value="TN Visa">TN Visa</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="coverLetter">Cover Letter (Optional)</Label>
              <Textarea id="coverLetter" placeholder="Tell us why you're interested in this position..." rows={4} />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Submit Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
};

export default JobDetailPage;