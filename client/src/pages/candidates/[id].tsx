import { useParams } from "wouter";
import { useCandidate } from "@/hooks/use-candidates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { formatDate, formatDateTime, formatRate } from "@/lib/date-utils";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Calendar, DollarSign, Mail, MapPin, Phone, User } from "lucide-react";
import { CircularProgress } from "@/components/ui/progress";
import WorkExperienceCard from "@/components/candidate/work-experience-card";
import { EmploymentHistoryCard } from "@/components/candidate/employment-history-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { transformResumeData } from "@/lib/resume-data-transformer";

function CandidateDetailPage() {
  const { id } = useParams();
  const candidateId = parseInt(id);
  
  const { data: candidate, isLoading, error } = useCandidate(candidateId);
  
  // Transform resume data from flat arrays to structured format
  const transformedResumeData = candidate?.resumeData ? 
    transformResumeData(candidate.resumeData) : undefined;
  
  // Log the candidate data for debugging
  console.log("Candidate data:", candidate);
  console.log("Original resume data:", candidate?.resumeData);
  console.log("Transformed resume data:", transformedResumeData);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading candidate details...</p>
        </div>
      </div>
    );
  }
  
  if (error || !candidate) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Candidate</h2>
        <p className="text-muted-foreground">{error?.message || "Candidate not found"}</p>
      </div>
    );
  }
  
  const hasResumeData = candidate.resumeData && Object.keys(candidate.resumeData).length > 0;
  
  // Calculate match rate statistics
  const submissionRates = candidate.submissions?.map(sub => sub.agreedRate || 0) || [];
  const avgRate = submissionRates.length > 0 
    ? submissionRates.reduce((sum, rate) => sum + rate, 0) / submissionRates.length 
    : 0;
  const minRate = submissionRates.length > 0 ? Math.min(...submissionRates) : 0;
  const maxRate = submissionRates.length > 0 ? Math.max(...submissionRates) : 0;
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {candidate.firstName} {candidate.middleName ? candidate.middleName + " " : ""}{candidate.lastName}
            </h1>
            
            {candidate.isUnreal && (
              <>
                <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>UNREAL CANDIDATE</span>
                </Badge>
              </>
            )}
          </div>
          <p className="text-muted-foreground">
            {candidate.workAuthorization} • Added on {formatDate(candidate.createdAt)}
          </p>
          
          {/* Display UNREAL reason prominently if candidate is marked as unreal */}
          {candidate.isUnreal && candidate.unrealReason && (
            <div className="mt-4 p-4 border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-md">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-700 dark:text-red-400">Candidate marked as UNREAL</h3>
                  <p className="text-red-700 dark:text-red-400 mt-1">{candidate.unrealReason}</p>
                  {candidate.lastValidated && (
                    <p className="text-xs text-red-500/70 mt-2">
                      Flagged on {formatDateTime(candidate.lastValidated)}
                      {candidate.validatedBy && ` by ${candidate.validatedBy}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="resume-data">Resume Data</TabsTrigger>
          <TabsTrigger value="submissions">Submissions ({candidate.submissions?.length || 0})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Full Name</p>
                    <p className="text-sm text-muted-foreground">
                      {candidate.firstName} {candidate.middleName || ""} {candidate.lastName}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{candidate.phone}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{candidate.email}</p>
                  </div>
                </div>
                
                {candidate.location && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{candidate.location}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Date of Birth</p>
                    <p className="text-sm text-muted-foreground">
                      {candidate.dobMonth}/{candidate.dobDay} (Month/Day)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Work & Authorization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Work Authorization</p>
                  <Badge variant="outline" className="mt-1">
                    {candidate.workAuthorization}
                  </Badge>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Relocation Preference</p>
                  <p className="text-sm text-muted-foreground">
                    {candidate.willingToRelocate ? "Willing to relocate" : "Not willing to relocate"}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">LinkedIn</p>
                  <p className="text-sm text-muted-foreground">
                    {candidate.linkedIn ? (
                      <a 
                        href={candidate.linkedIn.startsWith("http") ? candidate.linkedIn : `https://${candidate.linkedIn}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Profile
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">SSN (Last 4)</p>
                  <p className="text-sm text-muted-foreground">***-**-{candidate.ssn4}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Rates & Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {submissionRates.length > 0 ? (
                  <>
                    <div>
                      <p className="text-sm font-medium">Previously submitted on Rate</p>
                      <p className="text-xl font-bold text-primary">$70/hr</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium">Total Submissions</p>
                      <p className="text-sm font-semibold">{candidate.submissions?.length || 0}</p>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No submission rates available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="resume-data" className="space-y-6">
          {hasResumeData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Use our new component for employment history */}
              <div className="md:col-span-2">
                <EmploymentHistoryCard 
                  resumeData={candidate.resumeData}
                />
              </div>
              
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Skills & Technologies</CardTitle>
                  <CardDescription>Technical expertise and competencies</CardDescription>
                </CardHeader>
                <CardContent>
                  {transformedResumeData?.skills.technical && transformedResumeData.skills.technical.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Technical Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {transformedResumeData.skills.technical.map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="bg-primary/10">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {transformedResumeData.skills.soft.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Soft Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {transformedResumeData.skills.soft.map((skill, idx) => (
                              <Badge key={idx} variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {transformedResumeData.skills.certifications.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Certifications</h3>
                          <div className="flex flex-wrap gap-2">
                            {transformedResumeData.skills.certifications.map((cert, idx) => (
                              <Badge key={idx} variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {transformedResumeData.skills.publications && transformedResumeData.skills.publications.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Publications & Projects</h3>
                          <div className="flex flex-col gap-2">
                            {transformedResumeData.skills.publications.map((pub, idx) => (
                              <div key={idx} className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-2 text-sm">
                                <p className="text-purple-800 dark:text-purple-300">{pub}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-4">No skills detected</p>
                  )}
                </CardContent>
              </Card>
              
              <div className="md:col-span-2">
                <WorkExperienceCard workExperience={transformedResumeData?.workExperience || []} />
              </div>
              
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Education</CardTitle>
                  <CardDescription>Educational background and qualifications</CardDescription>
                </CardHeader>
                <CardContent>
                  {transformedResumeData?.education && transformedResumeData.education.length > 0 ? (
                    <div className="space-y-4">
                      {transformedResumeData.education.map((edu, idx) => (
                        <div key={idx} className="pl-4 border-l-2 border-primary/20">
                          <p className="font-medium">{edu}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-4">No education information detected</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-xl text-muted-foreground mb-2">No Resume Data Available</p>
                <p className="text-sm text-muted-foreground">
                  This candidate doesn't have any resume data extracted or processed yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="submissions" className="space-y-6">
          {candidate.submissions && candidate.submissions.length > 0 ? (
            <div className="space-y-6">
              {candidate.submissions.map((submission, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <CardTitle>{submission.job?.title || "Unknown Job"}</CardTitle>
                      <Badge
                        className={
                          submission.status === "submitted" ? "bg-yellow-500" :
                          submission.status === "accepted" ? "bg-green-500" :
                          submission.status === "rejected" ? "bg-red-500" :
                          "bg-blue-500"
                        }
                      >
                        {submission.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      Job ID: {submission.job?.jobId || "Unknown"} • 
                      Submitted on {formatDateTime(submission.submittedAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium">Submission Rate</p>
                        <p className="text-lg font-bold text-primary">{formatRate(submission.agreedRate)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium">Recruiter</p>
                        <p className="text-sm">{submission.recruiter?.name || "Unknown"}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium">Match Score</p>
                        <div className="flex items-center space-x-2">
                          <CircularProgress value={submission.matchScore || 0} size="small" />
                          <span className={
                            (submission.matchScore || 0) < 30 ? "text-red-500" :
                            (submission.matchScore || 0) < 70 ? "text-yellow-500" :
                            "text-green-500"
                          }>
                            {submission.matchScore || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {submission.notes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium">Notes</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{submission.notes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-xl text-muted-foreground mb-2">No Submissions Yet</p>
                <p className="text-sm text-muted-foreground">
                  This candidate hasn't been submitted to any jobs yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CandidateDetailPage;