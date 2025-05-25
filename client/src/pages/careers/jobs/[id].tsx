import React, { useState, FormEvent, ChangeEvent } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, MapPin, Briefcase, Building, Calendar, FileText, CheckCircle2, X } from "lucide-react";
import { useJob } from "@/hooks/use-jobs";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  
  // Fetch job data
  const { data: job, isLoading, error } = useJob(jobId);
  
  // Handle resume file upload
  const handleResumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Check file type
      if (file.type !== 'application/pdf' && 
          file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
          file.type !== 'application/msword') {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or Word document (.pdf, .doc, .docx)",
          variant: "destructive"
        });
        return;
      }
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Resume file must be less than 5MB",
          variant: "destructive"
        });
        return;
      }
      setResumeFile(file);
    }
  };
  
  // Reset form
  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCity("");
    setState("");
    setWorkAuthorization("");
    setCoverLetter("");
    setResumeFile(null);
    setFormSubmitted(false);
  };
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!firstName || !lastName || !email || !phone || !workAuthorization) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    if (!resumeFile) {
      toast({
        title: "Resume required",
        description: "Please upload your resume",
        variant: "destructive"
      });
      return;
    }
    
    // Create form data for file upload
    const formData = new FormData();
    formData.append('jobId', jobId.toString());
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('workAuthorization', workAuthorization);
    
    if (city) {
      formData.append('city', city);
    }
    
    if (state) {
      formData.append('state', state);
    }
    
    if (coverLetter) {
      formData.append('coverLetter', coverLetter);
    }
    
    if (resumeFile) {
      formData.append('resume', resumeFile);
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/public/applications', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit application');
      }
      
      // Show success message
      toast({
        title: "Application submitted",
        description: "Your application has been successfully submitted",
      });
      
      setFormSubmitted(true);
      setIsSubmitting(false);
      
      // Reset form after 3 seconds and close dialog
      setTimeout(() => {
        resetForm();
        setIsDialogOpen(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit application",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };
  
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
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Apply for {job.title}</DialogTitle>
            <DialogDescription>
              Submit your application for this position at {job.clientName || "the company"}.
            </DialogDescription>
          </DialogHeader>
          
          {formSubmitted ? (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-medium text-green-600">Application Submitted!</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Thank you for your application. We'll be in touch soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input 
                    id="firstName" 
                    placeholder="Your first name" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input 
                    id="lastName" 
                    placeholder="Your last name" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input 
                  id="phone" 
                  placeholder="(555) 123-4567" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    placeholder="Your city" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={state}
                    onValueChange={setState}
                  >
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select a state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AL">Alabama</SelectItem>
                      <SelectItem value="AK">Alaska</SelectItem>
                      <SelectItem value="AZ">Arizona</SelectItem>
                      <SelectItem value="AR">Arkansas</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="CO">Colorado</SelectItem>
                      <SelectItem value="CT">Connecticut</SelectItem>
                      <SelectItem value="DE">Delaware</SelectItem>
                      <SelectItem value="DC">District Of Columbia</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                      <SelectItem value="GA">Georgia</SelectItem>
                      <SelectItem value="HI">Hawaii</SelectItem>
                      <SelectItem value="ID">Idaho</SelectItem>
                      <SelectItem value="IL">Illinois</SelectItem>
                      <SelectItem value="IN">Indiana</SelectItem>
                      <SelectItem value="IA">Iowa</SelectItem>
                      <SelectItem value="KS">Kansas</SelectItem>
                      <SelectItem value="KY">Kentucky</SelectItem>
                      <SelectItem value="LA">Louisiana</SelectItem>
                      <SelectItem value="ME">Maine</SelectItem>
                      <SelectItem value="MD">Maryland</SelectItem>
                      <SelectItem value="MA">Massachusetts</SelectItem>
                      <SelectItem value="MI">Michigan</SelectItem>
                      <SelectItem value="MN">Minnesota</SelectItem>
                      <SelectItem value="MS">Mississippi</SelectItem>
                      <SelectItem value="MO">Missouri</SelectItem>
                      <SelectItem value="MT">Montana</SelectItem>
                      <SelectItem value="NE">Nebraska</SelectItem>
                      <SelectItem value="NV">Nevada</SelectItem>
                      <SelectItem value="NH">New Hampshire</SelectItem>
                      <SelectItem value="NJ">New Jersey</SelectItem>
                      <SelectItem value="NM">New Mexico</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="NC">North Carolina</SelectItem>
                      <SelectItem value="ND">North Dakota</SelectItem>
                      <SelectItem value="OH">Ohio</SelectItem>
                      <SelectItem value="OK">Oklahoma</SelectItem>
                      <SelectItem value="OR">Oregon</SelectItem>
                      <SelectItem value="PA">Pennsylvania</SelectItem>
                      <SelectItem value="RI">Rhode Island</SelectItem>
                      <SelectItem value="SC">South Carolina</SelectItem>
                      <SelectItem value="SD">South Dakota</SelectItem>
                      <SelectItem value="TN">Tennessee</SelectItem>
                      <SelectItem value="TX">Texas</SelectItem>
                      <SelectItem value="UT">Utah</SelectItem>
                      <SelectItem value="VT">Vermont</SelectItem>
                      <SelectItem value="VA">Virginia</SelectItem>
                      <SelectItem value="WA">Washington</SelectItem>
                      <SelectItem value="WV">West Virginia</SelectItem>
                      <SelectItem value="WI">Wisconsin</SelectItem>
                      <SelectItem value="WY">Wyoming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="resume">Resume/CV *</Label>
                <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4">
                  <div className="flex items-center justify-center w-full">
                    {resumeFile ? (
                      <div className="w-full text-center space-y-2">
                        <div className="flex items-center justify-center text-green-500">
                          <CheckCircle2 className="w-6 h-6 mr-2" />
                          <span className="font-medium">{resumeFile.name}</span>
                        </div>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm"
                          className="text-red-500"
                          onClick={() => setResumeFile(null)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove file
                        </Button>
                      </div>
                    ) : (
                      <label className="w-full flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-800 text-gray-500 rounded-lg tracking-wide border border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <FileText className="w-8 h-8" />
                        <span className="mt-2 text-sm">Upload your resume (PDF, DOCX)</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.doc,.docx" 
                          onChange={handleResumeChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="workAuthorization">Work Authorization *</Label>
                <select 
                  id="workAuthorization" 
                  className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  value={workAuthorization}
                  onChange={(e) => setWorkAuthorization(e.target.value)}
                  required
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
                <Textarea 
                  id="coverLetter" 
                  placeholder="Tell us why you're interested in this position..." 
                  rows={4}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="mr-2">Submitting...</span>
                      <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
};

export default JobDetailPage;