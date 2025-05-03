import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { analyzeResume } from "@/lib/openai";
import { useToast } from "@/hooks/use-toast";

interface ResumeAnalyzerProps {
  jobDescription: string;
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
      // Process the resume file (minimal processing only)
      const result = await analyzeResume(file);
      
      // Create minimal match result
      const matchResult = {
        score: 0,
        strengths: [],
        weaknesses: ["Resume analysis feature has been removed"],
        suggestions: ["Manual evaluation required"],
        technicalGaps: [],
        matchingSkills: [],
        missingSkills: [],
        clientExperience: "",
        confidence: 0
      };

      // Pass results to parent component
      onAnalysisComplete(result.analysis, matchResult);

      toast({
        title: "Resume Uploaded",
        description: "Resume file has been uploaded successfully.",
      });
    } catch (error) {
      console.error("Error processing resume:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to process the resume file. Please try again.",
        variant: "destructive",
      });
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
