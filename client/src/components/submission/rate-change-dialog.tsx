import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRate, formatDate } from "@/lib/date-utils";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RateChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  candidateName: string;
  currentRate: number;
  previousSubmissions: Array<{
    jobTitle?: string;
    submittedDate?: string;
    agreedRate?: number;
    status?: string;
  }>;
}

const RateChangeDialog: React.FC<RateChangeDialogProps> = ({
  isOpen,
  onClose,
  onContinue,
  candidateName,
  currentRate,
  previousSubmissions,
}) => {
  // Get the most recent previous rate for comparison
  const mostRecentSubmission = previousSubmissions
    .filter(sub => sub.agreedRate !== undefined && sub.agreedRate !== null)
    .sort((a, b) => new Date(b.submittedDate || 0).getTime() - new Date(a.submittedDate || 0).getTime())[0];

  const previousRate = mostRecentSubmission?.agreedRate || 0;
  const rateDifference = currentRate - previousRate;
  const percentageChange = previousRate > 0 ? ((rateDifference / previousRate) * 100).toFixed(1) : 0;

  const getRateChangeIcon = () => {
    if (rateDifference > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (rateDifference < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getRateChangeColor = () => {
    if (rateDifference > 0) return "text-green-600";
    if (rateDifference < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getRateChangeBadge = () => {
    if (rateDifference > 0) return <Badge variant="default" className="bg-green-100 text-green-800">Rate Increase</Badge>;
    if (rateDifference < 0) return <Badge variant="destructive">Rate Decrease</Badge>;
    return <Badge variant="secondary">Same Rate</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            Confirm Rate for Resubmission
          </DialogTitle>
          <DialogDescription>
            This candidate has been submitted before. Please confirm the rate for this new role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-gray-700">Candidate</h4>
                  <p className="font-semibold">{candidateName}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Previous Rate</h4>
                    <p className="font-semibold">{formatRate(previousRate)}</p>
                    {mostRecentSubmission?.jobTitle && (
                      <p className="text-xs text-gray-500">
                        {mostRecentSubmission.jobTitle}
                      </p>
                    )}
                    {mostRecentSubmission?.submittedDate && (
                      <p className="text-xs text-gray-500">
                        {formatDate(mostRecentSubmission.submittedDate)}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <h4 className="font-medium text-sm text-gray-700">New Rate</h4>
                    <p className="font-semibold">{formatRate(currentRate)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    {getRateChangeIcon()}
                    <span className={`font-medium ${getRateChangeColor()}`}>
                      {rateDifference >= 0 ? '+' : ''}{formatRate(rateDifference)} 
                      {percentageChange !== 0 && ` (${rateDifference >= 0 ? '+' : ''}${percentageChange}%)`}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getRateChangeBadge()}
                    <span className="text-xs text-gray-500">vs previous role</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {previousSubmissions.length > 1 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Recent Submissions</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {previousSubmissions.slice(0, 3).map((sub, index) => (
                  <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{sub.jobTitle || 'Unknown Job'}</p>
                      <p className="text-xs text-gray-500">{sub.submittedDate ? formatDate(sub.submittedDate) : 'Unknown date'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatRate(sub.agreedRate)}</p>
                      <Badge variant="outline" className="text-xs">
                        {sub.status || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel Submission
          </Button>
          <Button onClick={onContinue}>
            Confirm Rate & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RateChangeDialog;