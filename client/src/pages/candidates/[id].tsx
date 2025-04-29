import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useCandidate } from "@/hooks/use-candidates";
import { useSubmissions } from "@/hooks/use-submissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Briefcase, Calendar, Mail, Phone, MapPin, FileText, Tag, Users, Clock } from "lucide-react";
import { formatDate, formatDob, formatRate } from "@/lib/date-utils";

const CandidateDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const { data: candidate, isLoading: candidateLoading } = useCandidate(id);
  const { data: submissions, isLoading: submissionsLoading } = useSubmissions({ candidateId: id });

  if (candidateLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-700">Candidate not found</h2>
        <p className="mt-2 text-gray-500">The candidate you're looking for doesn't exist or has been removed.</p>
        <Button className="mt-4" onClick={() => setLocation("/candidates")}>
          Back to candidates
        </Button>
      </div>
    );
  }

  const getWorkAuthorizationDisplay = (auth: string) => {
    switch (auth) {
      case "citizen":
        return "US Citizen";
      case "green-card":
        return "Green Card";
      case "h1b":
        return "H1-B Visa";
      case "ead":
        return "EAD";
      default:
        return auth.charAt(0).toUpperCase() + auth.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground"
          onClick={() => setLocation("/candidates")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h2 className="text-2xl font-semibold">
          {candidate.firstName} {candidate.middleName && candidate.middleName + " "}{candidate.lastName}
        </h2>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="resume">Resume Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Basic candidate information</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Full Name</div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {candidate.firstName} {candidate.middleName || ""} {candidate.lastName}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Date of Birth</div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDob(candidate.dobMonth, candidate.dobDay)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`mailto:${candidate.email}`} 
                    className="font-medium text-primary hover:underline"
                  >
                    {candidate.email}
                  </a>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Phone</div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`tel:${candidate.phone}`} 
                    className="font-medium text-primary hover:underline"
                  >
                    {candidate.phone}
                  </a>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Location</div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{candidate.location}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Work Authorization</div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {getWorkAuthorizationDisplay(candidate.workAuthorization)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">LinkedIn</div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {candidate.linkedin ? (
                    <a 
                      href={candidate.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      View Profile
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">SSN (Last 4)</div>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">XXX-XX-{candidate.ssn4}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                <span>Created at: {formatDate(candidate.createdAt)}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="resume" className="space-y-6">
          {candidate.resumeData ? (
            <Card>
              <CardHeader>
                <CardTitle>Resume Data</CardTitle>
                <CardDescription>Information extracted from candidate's resume</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Client History</h3>
                  {candidate.resumeData.clientNames.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {candidate.resumeData.clientNames.map((client, index) => (
                        <div key={index} className="bg-muted p-3 rounded-lg">
                          <div className="font-medium">{client}</div>
                          {candidate.resumeData.relevantDates && candidate.resumeData.relevantDates[index] && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {candidate.resumeData.relevantDates[index]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">No client history found</div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Job Titles</h3>
                  {candidate.resumeData.jobTitles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {candidate.resumeData.jobTitles.map((title, index) => (
                        <Badge key={index} variant="secondary">{title}</Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">No job titles found</div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Skills</h3>
                  {candidate.resumeData.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {candidate.resumeData.skills.map((skill, index) => (
                        <Badge key={index}>{skill}</Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">No skills found</div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Education</h3>
                  {candidate.resumeData.education.length > 0 ? (
                    <div className="space-y-2">
                      {candidate.resumeData.education.map((edu, index) => (
                        <div key={index} className="bg-muted p-3 rounded-lg">
                          <div className="font-medium">{edu}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">No education history found</div>
                  )}
                </div>

                {candidate.resumeData.extractedText && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Extracted Text Sample</h3>
                      <div className="bg-muted p-3 rounded-lg text-sm max-h-40 overflow-y-auto">
                        {candidate.resumeData.extractedText.substring(0, 1000)}
                        {candidate.resumeData.extractedText.length > 1000 && '...'}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Resume Data</CardTitle>
                <CardDescription>
                  No resume data has been extracted for this candidate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Resume data may not be available because the candidate was added manually or
                  their resume could not be processed.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6">
          {submissionsLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : submissions && submissions.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Submission History</h3>
              {submissions.map((submission) => (
                <Card key={submission.id} className="hover:bg-accent/5 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">
                          {submission.job?.title || 'Unknown Job'}
                        </CardTitle>
                        <CardDescription>{submission.job?.jobId || 'No Job ID'}</CardDescription>
                      </div>
                      <Badge 
                        variant={
                          submission.status === 'accepted' ? 'success' :
                          submission.status === 'rejected' ? 'destructive' :
                          'secondary'
                        }
                      >
                        {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Submitted</div>
                        <div className="font-medium">{formatDate(submission.submittedAt)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Match Score</div>
                        <div className="font-medium">
                          {submission.matchScore !== null ? `${submission.matchScore}%` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Rate</div>
                        <div className="font-medium">
                          {submission.agreedRate ? formatRate(submission.agreedRate) : 'N/A'}
                        </div>
                      </div>
                    </div>
                    {submission.notes && (
                      <div className="mt-4 text-sm">
                        <div className="text-muted-foreground">Notes</div>
                        <div className="mt-1 bg-muted p-2 rounded-lg">{submission.notes}</div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="text-sm text-muted-foreground pt-0">
                    <div>Submitted by: {submission.recruiter?.name || 'Unknown'}</div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Submissions</CardTitle>
                <CardDescription>This candidate has not been submitted to any jobs yet</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  When this candidate is submitted to jobs, their submission history will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CandidateDetailPage;