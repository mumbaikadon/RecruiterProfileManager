import React from "react";
import { X, User, Phone, Mail, MapPin, Calendar, Briefcase, DollarSign, Shield, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
// Note: ScrollArea import commented out as it may not exist in all projects
// import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/date-utils";

interface CandidateProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: {
    id: number;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    jobTitle?: string | null;
    yearsOfExperience?: number | null;
    workAuthorization: string;
    rate?: string | null;
    dobMonth?: number | null;
    dobDay?: number | null;
    ssn4?: string | null;
    linkedIn?: string | null;
    resumeData?: {
      skills?: string[];
      education?: string[];
      workExperience?: string[];
      clientNames?: string[];
      jobTitles?: string[];
    };
    submissions?: Array<{
      id: number;
      status: string;
      agreedRate?: string;
      submittedAt: string;
      job?: {
        title: string;
        jobId: string;
      };
    }>;
  };
}

const CandidateProfilePopup: React.FC<CandidateProfilePopupProps> = ({
  isOpen,
  onClose,
  candidate
}) => {
  if (!isOpen || !candidate) return null;

  const fullName = `${candidate.firstName} ${candidate.middleName || ''} ${candidate.lastName}`.trim();
  const initials = `${candidate.firstName[0]}${candidate.lastName[0]}`.toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Popup Container - Responsive Design */}
      <div 
        className={cn(
          "fixed z-50 bg-background border border-border shadow-xl transition-all duration-300 ease-in-out",
          // Desktop: Right sidebar
          "lg:right-0 lg:top-0 lg:h-full lg:w-96",
          // Tablet: Modal overlay
          "md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90vw] md:max-w-2xl md:h-[90vh] md:rounded-lg",
          // Mobile: Bottom sheet
          "sm:bottom-0 sm:left-0 sm:right-0 sm:h-[85vh] sm:rounded-t-xl sm:translate-x-0 sm:translate-y-0",
          // Animation states
          isOpen 
            ? "lg:translate-x-0 md:scale-100 sm:translate-y-0" 
            : "lg:translate-x-full md:scale-95 sm:translate-y-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-lg">Candidate Profile</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 h-[calc(100%-4rem)] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Profile Header */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg font-semibold bg-primary/10">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-lg truncate">{fullName}</h4>
                    {candidate.jobTitle && (
                      <p className="text-sm text-muted-foreground">{candidate.jobTitle}</p>
                    )}
                    {candidate.yearsOfExperience && (
                      <p className="text-sm text-muted-foreground">
                        {candidate.yearsOfExperience} years experience
                      </p>
                    )}
                    <Badge variant="outline" className="mt-2">
                      {candidate.workAuthorization === 'citizen' ? 'US Citizen' :
                       candidate.workAuthorization === 'green-card' ? 'Green Card' :
                       candidate.workAuthorization === 'ead' ? 'EAD' : 'Other'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{candidate.email}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{candidate.phone}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{candidate.location}</span>
                </div>
                {candidate.rate && (
                  <div className="flex items-center space-x-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">{candidate.rate}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            {candidate.resumeData?.skills && candidate.resumeData.skills.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Skills</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {candidate.resumeData.skills.slice(0, 12).map((skill, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.resumeData.skills.length > 12 && (
                      <Badge variant="outline" className="text-xs">
                        +{candidate.resumeData.skills.length - 12} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Submissions */}
            {candidate.submissions && candidate.submissions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Recent Submissions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {candidate.submissions.slice(0, 3).map((submission) => (
                    <div key={submission.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {submission.job?.title || 'Unknown Job'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {submission.job?.jobId} • {formatDate(submission.submittedAt)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <Badge 
                            variant={
                              submission.status === 'accepted' ? 'default' :
                              submission.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }
                            className="text-xs"
                          >
                            {submission.status}
                          </Badge>
                          {submission.agreedRate && (
                            <span className="text-xs font-medium">{submission.agreedRate}</span>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </div>
                  ))}
                  {candidate.submissions.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{candidate.submissions.length - 3} more submissions
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Account Section (for desktop layout matching the image) */}
            <Card className="lg:block hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Account</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">ID: {candidate.id}</span>
                </div>
                {(candidate.dobMonth && candidate.dobDay) && (
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      DOB: {candidate.dobMonth}/{candidate.dobDay}
                    </span>
                  </div>
                )}
                {candidate.ssn4 && (
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">SSN: ***-**-{candidate.ssn4}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default CandidateProfilePopup;