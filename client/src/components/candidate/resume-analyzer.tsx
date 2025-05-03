
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { analyzeResume, matchResumeToJob } from "@/lib/openai";
import { useToast } from "@/hooks/use-toast";

interface ResumeAnalyzerProps {
  jobDescription: string;
  onAnalysisComplete: (resumeData: any, matchResults: any) => void;
}

const ResumeAnalyzer: React.FC<ResumeAnalyzerProps> = ({ 
  jobDescription, 
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

    // Clear previous resume data in parent
    onAnalysisComplete(null, null);
    setIsUploading(true);

    try {
      const result = await analyzeResume(file);

      if (!jobDescription || jobDescription.trim().length < 10) {
        toast({
          title: "Missing Job Description",
          description: "Job description is required for resume matching.",
          variant: "destructive",
        });

        const emptyMatchResult = {
          score: 0,
          strengths: [],
          weaknesses: ["Job description is required for resume analysis"],
          suggestions: ["Please provide a job description"],
          technicalGaps: [],
          matchingSkills: [],
          missingSkills: [],
          clientExperience: "",
          confidence: 0,
          clientNames: [],
          jobTitles: [],
          relevantDates: []
        };

        onAnalysisComplete(result.analysis, emptyMatchResult);
        return;
      }

      const matchResult = await matchResumeToJob(result.text, jobDescription);

      const updatedAnalysis = {
        ...result.analysis,
        clientNames: matchResult.clientNames ?? [],
        jobTitles: matchResult.jobTitles ?? [],
        relevantDates: matchResult.relevantDates ?? []
      };

      onAnalysisComplete(updatedAnalysis, matchResult);

      toast({
        title: "Resume Analyzed",
        description: `Resume analyzed with match score of ${matchResult.score}%.`,
      });
    } catch (error) {
      console.error("Error processing resume:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the resume. Please try again.",
        variant: "destructive",
      });

      const fallbackResult = {
        score: 0,
        strengths: [],
        weaknesses: ["Analysis failed"],
        suggestions: ["Try with a different resume or job description"],
        technicalGaps: [],
        matchingSkills: [],
        missingSkills: [],
        clientExperience: "",
        confidence: 0,
        clientNames: [],
        jobTitles: [],
        relevantDates: []
      };

      const fallbackResume = {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: file.name,
        fileName: file.name
      };

      onAnalysisComplete(fallbackResume, fallbackResult);
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
    </div>
  );
};

export default ResumeAnalyzer;
