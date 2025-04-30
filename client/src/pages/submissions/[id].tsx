import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useSubmission } from "@/hooks/use-submissions";
import { useJob } from "@/hooks/use-jobs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, FileText, Briefcase, User, Calendar, DollarSign, BarChart2, Lock, Shield } from "lucide-react";
import { formatDate, formatDateTime, formatRate } from "@/lib/date-utils";
import StatusBadge from "@/components/submission/status-badge";

const SubmissionDetailPage: React.FC = () => {
  const { id } = useParams();
  const submissionId = parseInt(id || "0");
  const { data: submission, isLoading, error } = useSubmission(submissionId);
  
  // Get detailed job information if available
  const jobId = submission?.job?.id;
  const { data: fullJobData } = useJob(jobId || 0);
  
  const [activeTab, setActiveTab] = useState("details");
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (error || !submission) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="ghost" className="pl-0" asChild>
            <Link to="/submissions">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Submissions
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Error Loading Submission</CardTitle>
            <CardDescription>
              There was a problem loading this submission. It may have been deleted or you may not have permission to view it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/submissions">Go Back to Submissions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Use the more detailed job data if available, otherwise use the submission.job data
  const job = fullJobData || submission.job;
  const candidate = submission.candidate;
  const recruiter = submission.recruiter;
  const resumeData = submission.resumeData || {
    clientNames: [],
    jobTitles: [],
    relevantDates: [],
    skills: [],
    education: [],
    extractedText: "",
    fileName: ""
  };
  
  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" className="pl-0" asChild>
          <Link to="/submissions">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Submissions
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
              <CardTitle className="text-xl md:text-2xl">
                {candidate?.firstName} {candidate?.lastName} - {job?.title}
              </CardTitle>
              <StatusBadge status={submission.status} className="mt-2 md:mt-0" />
            </div>
            <CardDescription>
              Submitted by {recruiter?.name} on {formatDateTime(submission.submittedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="details">Submission Details</TabsTrigger>
                <TabsTrigger value="job">Job Information</TabsTrigger>
                <TabsTrigger value="resume">Resume Data</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Candidate</div>
                      <div>{candidate?.firstName} {candidate?.lastName}</div>
                      <div className="text-sm text-muted-foreground">{candidate?.location}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Submitted</div>
                      <div>{formatDate(submission.submittedAt)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Agreed Rate</div>
                      <div className="text-lg font-semibold">
                        {submission.agreedRate 
                          ? formatRate(submission.agreedRate) 
                          : "Not specified"}
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-md font-medium mb-2">Match Score Analysis</h3>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative h-24 w-24 flex-shrink-0 flex items-center justify-center rounded-full bg-muted">
                      <div className="absolute text-xl font-bold">
                        {submission.matchScore || 0}%
                      </div>
                      {/* Circular progress indicator */}
                      <svg className="absolute h-24 w-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="45" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="10" 
                          strokeOpacity="0.1" 
                        />
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="45" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="10" 
                          strokeDasharray={`${2 * Math.PI * 45}`} 
                          strokeDashoffset={`${2 * Math.PI * 45 * (1 - (submission.matchScore || 0) / 100)}`}
                          className="text-primary" 
                        />
                      </svg>
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      {submission.strengths && submission.strengths.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">Strengths</h4>
                          <ul className="list-disc list-inside text-sm space-y-1 ml-1">
                            {submission.strengths.map((strength: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {submission.weaknesses && submission.weaknesses.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Areas for Improvement</h4>
                          <ul className="list-disc list-inside text-sm space-y-1 ml-1">
                            {submission.weaknesses.map((weakness: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{weakness}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {submission.suggestions && submission.suggestions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Suggestions</h4>
                          <ul className="list-disc list-inside text-sm space-y-1 ml-1">
                            {submission.suggestions.map((suggestion: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {submission.missingSkills && submission.missingSkills.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Missing Skills</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {submission.missingSkills.map((skill: string, i: number) => (
                              <Badge key={i} variant="outline" className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {submission.technicalGaps && submission.technicalGaps.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400">Technical Gaps</h4>
                          <ul className="list-disc list-inside text-sm space-y-1 ml-1">
                            {submission.technicalGaps.map((gap: string, i: number) => (
                              <li key={i} className="text-muted-foreground">{gap}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {submission.confidence && (
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Analysis Confidence</h4>
                          <div className="flex items-center mt-1">
                            <Shield className="h-4 w-4 text-slate-500 mr-1" />
                            <span className="text-sm text-muted-foreground">{submission.confidence}%</span>
                          </div>
                        </div>
                      )}
                      
                      {(!submission.strengths || !submission.strengths.length) && 
                       (!submission.weaknesses || !submission.weaknesses.length) && 
                       (!submission.suggestions || !submission.suggestions.length) && (
                        <p className="text-sm text-muted-foreground">
                          Match score indicates how well the candidate's skills align with job requirements.
                          More detailed analysis will be available when the resume is analyzed against the job description.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {submission.notes && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-md font-medium mb-2">Notes</h3>
                      <p className="text-sm whitespace-pre-wrap">{submission.notes}</p>
                    </div>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="job" className="space-y-5">
                <div className="bg-muted p-4 rounded-md">
                  <div className="flex items-start space-x-3">
                    <Briefcase className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">{job?.title}</h3>
                      <div className="text-sm text-muted-foreground">Job ID: {job?.jobId}</div>
                      <div className="mt-1 flex items-center">
                        <Badge variant={job?.status === "active" ? "success" : "secondary"}>
                          {job?.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                {fullJobData && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-md font-medium mb-1">Description</h3>
                      <p className="text-sm">{fullJobData.description || "No description provided"}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-md font-medium mb-1">Location</h3>
                        <p className="text-sm">{fullJobData.location || "Remote"}</p>
                      </div>
                      <div>
                        <h3 className="text-md font-medium mb-1">Client</h3>
                        <p className="text-sm">{fullJobData.clientName || "Not specified"}</p>
                      </div>
                      {fullJobData.maxRate && (
                        <div>
                          <h3 className="text-md font-medium mb-1">Maximum Rate</h3>
                          <p className="text-sm">{formatRate(fullJobData.maxRate)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="resume" className="space-y-5">
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex items-start space-x-3">
                      <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Resume Data</h3>
                        <div className="text-sm text-muted-foreground">
                          Extracted and analyzed from candidate's resume
                          {job?.status?.toLowerCase() !== 'active' && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400">
                               (Job is closed - file download restricted)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* AI Resume Analysis Section */}
                  {(resumeData.qualityScore || resumeData.keywordScore || resumeData.readabilityScore) && (
                    <div className="bg-background border border-border p-4 rounded-md">
                      <h3 className="text-md font-medium mb-3">AI Resume Analysis</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {resumeData.qualityScore && (
                          <div className="flex flex-col items-center p-3 bg-primary/5 rounded-md">
                            <span className="text-xs text-muted-foreground mb-1">Overall Quality</span>
                            <div className="text-lg font-semibold text-primary">{resumeData.qualityScore}/100</div>
                          </div>
                        )}
                        
                        {resumeData.keywordScore && (
                          <div className="flex flex-col items-center p-3 bg-primary/5 rounded-md">
                            <span className="text-xs text-muted-foreground mb-1">Keywords</span>
                            <div className="text-lg font-semibold text-primary">{resumeData.keywordScore}/100</div>
                          </div>
                        )}
                        
                        {resumeData.readabilityScore && (
                          <div className="flex flex-col items-center p-3 bg-primary/5 rounded-md">
                            <span className="text-xs text-muted-foreground mb-1">Readability</span>
                            <div className="text-lg font-semibold text-primary">{resumeData.readabilityScore}/100</div>
                          </div>
                        )}
                      </div>
                      
                      {resumeData.contentSuggestions && resumeData.contentSuggestions.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content Suggestions:</h4>
                          <ul className="pl-5 text-sm text-gray-600 dark:text-gray-400 list-disc">
                            {resumeData.contentSuggestions.map((suggestion: string, index: number) => (
                              <li key={index} className="mb-1">{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {resumeData.formattingSuggestions && resumeData.formattingSuggestions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Formatting Suggestions:</h4>
                          <ul className="pl-5 text-sm text-gray-600 dark:text-gray-400 list-disc">
                            {resumeData.formattingSuggestions.map((suggestion: string, index: number) => (
                              <li key={index} className="mb-1">{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Skills Section with Visual Enhancement */}
                    {resumeData.skills && resumeData.skills.length > 0 && (
                      <div className="bg-background border border-border p-4 rounded-md">
                        <h3 className="text-md font-medium mb-3">Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {resumeData.skills.map((skill: string, i: number) => (
                            <Badge key={i} variant="outline" className="bg-accent/30">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Education Section */}
                    {resumeData.education && resumeData.education.length > 0 && (
                      <div className="bg-background border border-border p-4 rounded-md">
                        <h3 className="text-md font-medium mb-3">Education</h3>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {resumeData.education.map((edu: string, i: number) => (
                            <li key={i}>{edu}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Job Titles */}
                    {resumeData.jobTitles && resumeData.jobTitles.length > 0 && (
                      <div className="bg-background border border-border p-4 rounded-md">
                        <h3 className="text-md font-medium mb-3">Previous Job Titles</h3>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {resumeData.jobTitles.map((title: string, i: number) => (
                            <li key={i}>{title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Client Experience */}
                    {resumeData.clientNames && resumeData.clientNames.length > 0 && (
                      <div className="bg-background border border-border p-4 rounded-md">
                        <h3 className="text-md font-medium mb-3">Previous Clients</h3>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {resumeData.clientNames.map((client: string, i: number) => (
                            <li key={i}>{client}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  {/* Resume File Download */}
                  {resumeData.fileName && (
                    <div className="bg-background border border-border p-4 rounded-md">
                      <h3 className="text-md font-medium mb-3">Resume File</h3>
                      <div className="bg-accent/20 p-4 rounded-md flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 mr-2 text-primary" />
                          <span className="text-sm">{resumeData.fileName}</span>
                        </div>
                        {job?.status?.toLowerCase() !== 'active' ? (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center">
                            <Lock className="h-4 w-4 mr-1" />
                            <span>File restricted (Job closed)</span>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={() => {
                              // Always use the candidate ID to fetch the resume
                              const downloadUrl = `/api/candidates/${candidate?.id}/resume`;
                              console.log("Downloading resume from:", downloadUrl);
                              window.open(downloadUrl, '_blank');
                            }}
                          >
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Full Resume Text with Better Formatting */}
                  {resumeData.extractedText && (
                    <div className="bg-background border border-border p-4 rounded-md">
                      <h3 className="text-md font-medium mb-3">Full Resume Text</h3>
                      <div className="bg-muted rounded-md p-4 max-h-96 overflow-y-auto">
                        <p className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                          {resumeData.extractedText.startsWith("This appears to be a PDF file") ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {resumeData.extractedText}
                            </span>
                          ) : (
                            resumeData.extractedText
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubmissionDetailPage;