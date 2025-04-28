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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resumeData, setResumeData] = useState<any | null>(null);
  const [matchResults, setMatchResults] = useState<any | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please upload a resume to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      // Process the resume
      const result = await analyzeResume(file);
      setResumeData(result.analysis);
      
      // Match against job description
      const matchResult = await matchResumeToJob(result.text, jobDescription);
      setMatchResults(matchResult);
      
      // Pass results to parent component
      onAnalysisComplete(result.analysis, matchResult);
      
      toast({
        title: "Analysis Complete",
        description: "Resume has been analyzed successfully.",
      });
    } catch (error) {
      console.error("Error analyzing resume:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze the resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resume Analyzer</CardTitle>
          <CardDescription>
            Upload a resume to analyze its fit for the job description
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
              onClick={handleAnalyze}
              disabled={!file || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                  Analyzing...
                </>
              ) : (
                "Analyze Resume"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {matchResults && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Match score: <span className="font-bold">{matchResults.score}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Strengths:</h3>
              <ul className="pl-5 text-sm text-gray-600 list-disc">
                {matchResults.strengths.map((strength: string, index: number) => (
                  <li key={index} className="mb-1">{strength}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Potential Gaps:</h3>
              <ul className="pl-5 text-sm text-gray-600 list-disc">
                {matchResults.weaknesses.map((weakness: string, index: number) => (
                  <li key={index} className="mb-1">{weakness}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Improvement Suggestions:</h3>
              <ul className="pl-5 text-sm text-gray-600 list-disc">
                {matchResults.suggestions.map((suggestion: string, index: number) => (
                  <li key={index} className="mb-1">{suggestion}</li>
                ))}
              </ul>
            </div>
            
            {resumeData && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Extracted Data:</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Client History:</p>
                    <p className="text-sm text-gray-700">{resumeData.clientNames.join(", ") || "None detected"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Job Titles:</p>
                    <p className="text-sm text-gray-700">{resumeData.jobTitles.join(", ") || "None detected"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Key Skills:</p>
                    <p className="text-sm text-gray-700">{resumeData.skills.join(", ") || "None detected"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Education:</p>
                    <p className="text-sm text-gray-700">{resumeData.education.join(", ") || "None detected"}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResumeAnalyzer;
