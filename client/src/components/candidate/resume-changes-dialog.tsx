import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  Plus, 
  Minus, 
  Building, 
  Briefcase, 
  Calendar, 
  GraduationCap, 
  Settings,
  FileText,
  Flag,
  CheckCircle
} from "lucide-react";
import { ResumeComparisonResult, getChangesSeverity } from "@/lib/resume-comparison";

interface ResumeChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
  jobId: number;
  jobTitle: string;
  comparison: ResumeComparisonResult;
  resumeFileName?: string;
  onProceed: (flagAsSuspicious: boolean, reason?: string, severity?: "LOW" | "MEDIUM" | "HIGH") => void;
  onCancel: () => void;
}

const ResumeChangesDialog: React.FC<ResumeChangesDialogProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  jobId,
  jobTitle,
  comparison,
  resumeFileName,
  onProceed,
  onCancel,
}) => {
  const [flagAsSuspicious, setFlagAsSuspicious] = useState(false);
  const [suspiciousReason, setSuspiciousReason] = useState("");
  const { toast } = useToast();

  const handleProceed = () => {
    if (flagAsSuspicious && !suspiciousReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for flagging this candidate as suspicious",
        variant: "destructive",
      });
      return;
    }

    const severity = getChangesSeverity(comparison);
    onProceed(flagAsSuspicious, flagAsSuspicious ? suspiciousReason : undefined, severity);
  };

  const renderChangesList = (items: string[], type: "added" | "removed", icon: React.ReactNode, label: string) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{label}</span>
          <Badge variant={type === "added" ? "default" : "secondary"} className="text-xs">
            {type === "added" ? "New" : "Removed"}
          </Badge>
        </div>
        <div className="ml-6 space-y-1">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              {type === "added" ? (
                <Plus className="h-3 w-3 text-green-600" />
              ) : (
                <Minus className="h-3 w-3 text-red-600" />
              )}
              <span className={type === "added" ? "text-green-700" : "text-red-700"}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const severity = getChangesSeverity(comparison);
  const severityColor = {
    LOW: "bg-yellow-100 text-yellow-800 border-yellow-200",
    MEDIUM: "bg-orange-100 text-orange-800 border-orange-200", 
    HIGH: "bg-red-100 text-red-800 border-red-200"
  }[severity];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Changes Detected
          </DialogTitle>
          <DialogDescription>
            Changes detected in {candidateName}'s resume for {jobTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card className={`border-2 ${severityColor}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Changes Summary
                </CardTitle>
                <Badge variant="outline" className={severityColor}>
                  {severity} Risk
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Resume file: <span className="font-medium">{resumeFileName || "Unknown"}</span>
              </p>
              <p className="text-sm">{comparison.changesSummary}</p>
            </CardContent>
          </Card>

          {/* Changes Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Detailed Changes</h3>
            
            <div className="grid gap-4">
              {/* Company/Client Changes */}
              {(comparison.addedClients.length > 0 || comparison.removedClients.length > 0) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Companies/Clients
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderChangesList(comparison.addedClients, "added", <Building className="h-4 w-4" />, "Added Companies")}
                    {renderChangesList(comparison.removedClients, "removed", <Building className="h-4 w-4" />, "Removed Companies")}
                  </CardContent>
                </Card>
              )}

              {/* Job Title Changes */}
              {(comparison.addedJobTitles.length > 0 || comparison.removedJobTitles.length > 0) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Job Titles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderChangesList(comparison.addedJobTitles, "added", <Briefcase className="h-4 w-4" />, "Added Titles")}
                    {renderChangesList(comparison.removedJobTitles, "removed", <Briefcase className="h-4 w-4" />, "Removed Titles")}
                  </CardContent>
                </Card>
              )}

              {/* Date Changes */}
              {(comparison.addedDates.length > 0 || comparison.removedDates.length > 0) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Employment Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderChangesList(comparison.addedDates, "added", <Calendar className="h-4 w-4" />, "Added Dates")}
                    {renderChangesList(comparison.removedDates, "removed", <Calendar className="h-4 w-4" />, "Removed Dates")}
                  </CardContent>
                </Card>
              )}

              {/* Skills Changes */}
              {(comparison.addedSkills.length > 0 || comparison.removedSkills.length > 0) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Skills
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderChangesList(comparison.addedSkills, "added", <Settings className="h-4 w-4" />, "Added Skills")}
                    {renderChangesList(comparison.removedSkills, "removed", <Settings className="h-4 w-4" />, "Removed Skills")}
                  </CardContent>
                </Card>
              )}

              {/* Education Changes */}
              {(comparison.addedEducation.length > 0 || comparison.removedEducation.length > 0) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderChangesList(comparison.addedEducation, "added", <GraduationCap className="h-4 w-4" />, "Added Education")}
                    {renderChangesList(comparison.removedEducation, "removed", <GraduationCap className="h-4 w-4" />, "Removed Education")}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Separator />

          {/* Flagging Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Review Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="flag-suspicious" className="text-sm font-medium">
                    Flag as Suspicious
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Mark this candidate's profile changes as potentially fraudulent
                  </p>
                </div>
                <Switch
                  id="flag-suspicious"
                  checked={flagAsSuspicious}
                  onCheckedChange={setFlagAsSuspicious}
                />
              </div>

              {flagAsSuspicious && (
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Flagging</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explain why these changes seem suspicious (e.g., significant timeline alterations, unrealistic career progression, etc.)"
                    value={suspiciousReason}
                    onChange={(e) => setSuspiciousReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel Submission
          </Button>
          <Button onClick={handleProceed} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Proceed with Submission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResumeChangesDialog;