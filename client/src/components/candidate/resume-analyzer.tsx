import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { analyzeResume, matchResumeToJob } from "@/lib/openai";
import { useToast } from "@/hooks/use-toast";

interface ResumeAnalyzerProps {
  jobDescription: string;
  jobId?: number;
  clientFocus?: string;
  onAnalysisComplete: (resumeData: any, matchResults: any) => void;
}

/**
 * Simplified Resume Uploader Component
 * 
 * Analysis features have been removed, this is now just a basic file uploader
 * that passes minimal metadata to the parent component
 */
const ResumeAnalyzer: React.FC<ResumeAnalyzerProps> = ({ 
  jobDescription, 
  jobId,
  clientFocus,
  onAnalysisComplete 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please upload a resume file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Process the resume file
      const result = await analyzeResume(file);
      
      // Job description must be provided
      if (!jobDescription || jobDescription.trim().length < 10) {
        toast({
          title: "Missing Job Description",
          description: "Job description is required for resume matching.",
          variant: "destructive",
        });
        
        // Provide empty match result if no job description (with client focus fields for consistency)
        const emptyMatchResult = {
          score: 0,
          strengths: [],
          weaknesses: ["Job description is required for resume analysis"],
          suggestions: ["Please provide a job description"],
          technicalGaps: [],
          matchingSkills: [],
          missingSkills: [],
          
          // Include empty client focus fields for consistency
          clientFocusScore: 0,
          clientFocusMatches: [],
          clientFocusMissing: [],
          
          // Legacy fields
          clientExperience: "",
          confidence: 0
        };
        
        onAnalysisComplete(result.analysis, emptyMatchResult);
        return;
      }
      
      // Match resume against job description
      console.log("Matching resume against job description...");
      console.log("Resume text:", result.text.substring(0, 100) + "...");
      console.log("Job description:", jobDescription.substring(0, 100) + "...");
      
      const matchResult = await matchResumeToJob(
        result.text, 
        jobDescription,
        undefined, // candidateId (optional)
        jobId,     // pass the job ID if available
        clientFocus // pass client focus if available
      );
      
      console.log("Match result:", matchResult);
      
      // Log client focus matching details if available
      if (clientFocus) {
        console.log("Client focus used for matching:", clientFocus);
        console.log("Client focus score:", matchResult.clientFocusScore);
        console.log("Client focus matches:", matchResult.clientFocusMatches);
        console.log("Client focus missing skills:", matchResult.clientFocusMissing);
      }
      
      // Update the analysis object with the structured employment history and client focus match data
      const updatedAnalysis = {
        ...result.analysis,
        // Employment history data
        clientNames: matchResult.clientNames || [],
        jobTitles: matchResult.jobTitles || [],
        relevantDates: matchResult.relevantDates || [],
        
        // Client focus match data
        clientFocusScore: matchResult.clientFocusScore || 0,
        clientFocusMatches: matchResult.clientFocusMatches || [],
        clientFocusMissing: matchResult.clientFocusMissing || []
      };
      
      console.log("Complete resume analysis with employment history:", updatedAnalysis);

      // Pass updated results to parent component
      onAnalysisComplete(updatedAnalysis, matchResult);

      // Prepare a more detailed toast message that includes client focus information when available
      let toastMessage = `Resume analyzed with match score of ${matchResult.score}%.`;
      
      // Add client focus information if available
      if (clientFocus && matchResult.clientFocusScore) {
        toastMessage += ` Client focus match: ${matchResult.clientFocusScore}%.`;
      }
      
      toast({
        title: "Resume Analyzed",
        description: toastMessage,
      });
    } catch (error) {
      console.error("Error processing resume:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the resume. Please try again.",
        variant: "destructive",
      });
      
      // Provide error match result with client focus fields for consistency
      const errorMatchResult = {
        score: 0,
        strengths: [],
        weaknesses: [error instanceof Error ? error.message : "Analysis failed"],
        suggestions: ["Try with a different resume or job description"],
        technicalGaps: [],
        matchingSkills: [],
        missingSkills: [],
        
        // Include empty client focus fields for consistency
        clientFocusScore: 0,
        clientFocusMatches: [],
        clientFocusMissing: [],
        
        // Legacy fields
        clientExperience: "",
        confidence: 0
      };
      
      // If resume was successfully processed but matching failed, still pass the resume data
      if (file) {
        const basicInfo = {
          // Basic resume data
          clientNames: [],
          jobTitles: [],
          relevantDates: [],
          skills: [],
          education: [],
          extractedText: `Resume file: ${file.name}`,
          fileName: file.name,
          
          // Include empty client focus fields for consistency
          clientFocusScore: 0,
          clientFocusMatches: [],
          clientFocusMissing: []
        };
        
        onAnalysisComplete(basicInfo, errorMatchResult);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resume Upload</CardTitle>
          <CardDescription>
            Upload a resume file to include with the candidate submission
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-blue-600"
            />
            <p className="mt-2 text-sm text-gray-500">PDF or Word document only.</p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
            >
              {isUploading ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                  Uploading...
                </>
              ) : (
                "Upload Resume"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {file && (
        <Card>
          <CardHeader>
            <CardTitle>Resume File</CardTitle>
            <CardDescription>
              Basic information about the uploaded file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">File Name:</p>
                <p className="text-sm text-gray-600">{file.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">File Size:</p>
                <p className="text-sm text-gray-600">{Math.round(file.size / 1024)} KB</p>
              </div>
              <div>
                <p className="text-sm font-medium">File Type:</p>
                <p className="text-sm text-gray-600">
                  {file.name.toLowerCase().endsWith('.pdf') ? 'PDF Document' : 
                   file.name.toLowerCase().endsWith('.docx') ? 'Word Document (DOCX)' :
                   file.name.toLowerCase().endsWith('.doc') ? 'Word Document (DOC)' : 
                   'Document'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Last Modified:</p>
                <p className="text-sm text-gray-600">{new Date(file.lastModified).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResumeAnalyzer;
