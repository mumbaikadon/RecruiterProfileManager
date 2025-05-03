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
            <CardTitle>Match Analysis</CardTitle>
            <CardDescription className="flex items-center">
              <div className="bg-gray-200 rounded-full h-4 w-40 mr-2">
                <div 
                  className={`h-4 rounded-full ${
                    matchResults.score >= 80 ? 'bg-green-500' : 
                    matchResults.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${matchResults.score}%` }}
                ></div>
              </div>
              <span className="font-bold">{matchResults.score}% Match</span>
              {matchResults.confidence && (
                <span className="ml-4 text-xs text-muted-foreground">
                  Confidence: {matchResults.confidence}%
                </span>
              )}
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

            {matchResults.technicalGaps && matchResults.technicalGaps.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Technical Gaps:</h3>
                <ul className="pl-5 text-sm text-gray-600 list-disc">
                  {matchResults.technicalGaps.map((gap: string, index: number) => (
                    <li key={index} className="mb-1">{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {matchResults.clientExperience && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Client Experience Analysis:</h3>
                <p className="text-sm text-gray-600 pl-2 border-l-2 border-gray-300">{matchResults.clientExperience}</p>
              </div>
            )}

            {resumeData && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Resume Analysis</h3>

                {resumeData.aiEnhanced && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-gray-700">Quality Metrics</h4>
                      {resumeData.qualityScore && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                          Overall: {resumeData.qualityScore}/100
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mb-3">
                      {resumeData.keywordScore && (
                        <div className="flex flex-col items-center p-2 bg-gray-50 rounded">
                          <span className="text-xs text-gray-500">Keywords</span>
                          <span className="text-sm font-medium">{resumeData.keywordScore}/100</span>
                        </div>
                      )}
                      {resumeData.readabilityScore && (
                        <div className="flex flex-col items-center p-2 bg-gray-50 rounded">
                          <span className="text-xs text-gray-500">Readability</span>
                          <span className="text-sm font-medium">{resumeData.readabilityScore}/100</span>
                        </div>
                      )}
                    </div>

                    {resumeData.contentSuggestions && resumeData.contentSuggestions.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-700 mb-1">Content Suggestions:</h4>
                        <ul className="pl-5 text-xs text-gray-600 list-disc">
                          {resumeData.contentSuggestions.map((suggestion: string, index: number) => (
                            <li key={index} className="mb-1">{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {resumeData.formattingSuggestions && resumeData.formattingSuggestions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-1">Formatting Suggestions:</h4>
                        <ul className="pl-5 text-xs text-gray-600 list-disc">
                          {resumeData.formattingSuggestions.map((suggestion: string, index: number) => (
                            <li key={index} className="mb-1">{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

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
