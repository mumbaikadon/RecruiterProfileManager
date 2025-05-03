import { useState, useRef } from "react";
import { Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define the schema for the analysis form
const resumeAnalysisSchema = z.object({
  jobDescription: z.string().min(10, "Job description must be at least 10 characters long")
});

// Define the type for the form data
type ResumeAnalysisFormData = z.infer<typeof resumeAnalysisSchema>;

// Define the type for the analysis result
interface AnalysisResult {
  skillsGapAnalysis: {
    missingSkills: string[];
    matchingSkills: string[];
    suggestedTraining: string[];
  };
  relevantExperience: string[];
  improvements: {
    content: string[];
    formatting: string[];
    language: string[];
  };
  overallScore: number;
  confidenceScore: number;
}

export default function PublicResumeAnalysis() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<ResumeAnalysisFormData>({
    resolver: zodResolver(resumeAnalysisSchema),
    defaultValues: {
      jobDescription: ""
    }
  });

  const { mutate: analyzeResume, isPending: isAnalyzing } = useMutation({
    mutationFn: async (data: { jobDescription: string, resumeFile: File }) => {
      const formData = new FormData();
      formData.append("jobDescription", data.jobDescription);
      formData.append("resumeFile", data.resumeFile);

      const response = await fetch("/api/public/analyze-resume", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to analyze resume");
      }

      return response.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResult(data);
      toast({
        title: "Analysis Complete",
        description: "Your resume has been analyzed successfully",
      });
    },
    onError: (error: Error) => {
      // Check if the error is due to authentication requirement
      if (error.message.includes("Authentication required")) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to use the resume analysis feature.",
          variant: "default"
        });
        
        // Redirect to login page after a small delay
        setTimeout(() => {
          window.location.href = "/auth";
        }, 1500);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to analyze resume",
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (values: ResumeAnalysisFormData) => {
    if (!resumeFile) {
      toast({
        title: "Missing File",
        description: "Please upload a resume file (.pdf, .doc, or .docx)",
        variant: "destructive"
      });
      return;
    }

    analyzeResume({
      jobDescription: values.jobDescription,
      resumeFile
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Check if the file is a PDF or Word document
      if (
        file.type === "application/pdf" ||
        file.type === "application/msword" ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        setResumeFile(file);
        toast({
          title: "File Uploaded",
          description: `${file.name} has been uploaded successfully`,
        });
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload a PDF or Word document",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
          <div className="flex justify-center">
            <Link href="/" className="flex items-center text-2xl font-semibold">
              <FileText className="h-8 w-8 mr-2 text-primary" />
              <span>ResumeMatch AI</span>
            </Link>
          </div>
          
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Analyze Your Resume
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Upload your resume and a job description to get detailed insights and improvement suggestions
          </p>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-center text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">Authentication Required</p>
            <p className="mt-1">You'll need to sign in to use the resume analysis feature. Limited to 5 analyses per day.</p>
            <Link href="/auth">
              <Button variant="link" className="mt-1 text-blue-700 dark:text-blue-300">
                Sign in or Create an Account
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-4xl">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resume">Upload Resume</Label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                    <div className="space-y-1 text-center">
                      <div className="flex flex-col items-center">
                        {resumeFile ? (
                          <div className="flex flex-col items-center text-green-500">
                            <div className="flex items-center">
                              <CheckCircle className="h-6 w-6 mr-2" />
                              <span className="font-medium">{resumeFile.name}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setResumeFile(null)}
                              className="mt-2 text-xs text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Remove file
                            </Button>
                          </div>
                        ) : (
                          <Upload className="h-12 w-12 text-gray-400" />
                        )}
                      </div>
                      <div className="flex text-sm text-gray-600 dark:text-gray-400">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none"
                        >
                          <span>Upload a file</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PDF, DOC, DOCX up to 5MB
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="jobDescription">Job Description</Label>
                  <Textarea
                    id="jobDescription"
                    placeholder="Paste the job description here..."
                    className="mt-1 h-40"
                    {...form.register("jobDescription")}
                  />
                  {form.formState.errors.jobDescription && (
                    <p className="mt-1 text-sm text-red-500">
                      {form.formState.errors.jobDescription.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isAnalyzing || !resumeFile}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Resume...
                    </>
                  ) : !resumeFile ? (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Resume First
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Analyze Resume
                    </>
                  )}
                </Button>
              </div>
            </form>

            {analysisResult && (
              <div className="mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Resume Analysis Results</CardTitle>
                    <CardDescription>
                      Overall Match Score: {analysisResult.overallScore}%
                    </CardDescription>
                    <Progress value={analysisResult.overallScore} className="h-2" />
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="skills">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
                        <TabsTrigger value="experience">Experience</TabsTrigger>
                        <TabsTrigger value="improvements">Improvements</TabsTrigger>
                        <TabsTrigger value="training">Training</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="skills" className="space-y-4">
                        <div>
                          <h3 className="text-lg font-medium mb-2">Matching Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.skillsGapAnalysis.matchingSkills.map((skill, i) => (
                              <Badge key={i} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                                {skill}
                              </Badge>
                            ))}
                            {analysisResult.skillsGapAnalysis.matchingSkills.length === 0 && (
                              <p className="text-sm text-gray-500">No matching skills found</p>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-lg font-medium mb-2">Missing Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.skillsGapAnalysis.missingSkills.map((skill, i) => (
                              <Badge key={i} variant="outline" className="bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
                                {skill}
                              </Badge>
                            ))}
                            {analysisResult.skillsGapAnalysis.missingSkills.length === 0 && (
                              <p className="text-sm text-gray-500">No missing skills detected</p>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="experience">
                        <div>
                          <h3 className="text-lg font-medium mb-3">Relevant Experience</h3>
                          {analysisResult.relevantExperience.length > 0 ? (
                            <ul className="space-y-2">
                              {analysisResult.relevantExperience.map((exp, i) => (
                                <li key={i} className="text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                  {exp}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No relevant experience identified</p>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="improvements" className="space-y-4">
                        <div>
                          <h3 className="text-lg font-medium mb-2">Content Improvements</h3>
                          {analysisResult.improvements.content.length > 0 ? (
                            <ul className="space-y-2">
                              {analysisResult.improvements.content.map((item, i) => (
                                <li key={i} className="text-sm p-2 bg-amber-50 dark:bg-amber-900/20 rounded flex">
                                  <AlertCircle className="h-5 w-5 mr-2 text-amber-500 shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No content improvements suggested</p>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="text-lg font-medium mb-2">Formatting Improvements</h3>
                          {analysisResult.improvements.formatting.length > 0 ? (
                            <ul className="space-y-2">
                              {analysisResult.improvements.formatting.map((item, i) => (
                                <li key={i} className="text-sm p-2 bg-blue-50 dark:bg-blue-900/20 rounded flex">
                                  <AlertCircle className="h-5 w-5 mr-2 text-blue-500 shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No formatting improvements suggested</p>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="text-lg font-medium mb-2">Language Improvements</h3>
                          {analysisResult.improvements.language.length > 0 ? (
                            <ul className="space-y-2">
                              {analysisResult.improvements.language.map((item, i) => (
                                <li key={i} className="text-sm p-2 bg-purple-50 dark:bg-purple-900/20 rounded flex">
                                  <AlertCircle className="h-5 w-5 mr-2 text-purple-500 shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No language improvements suggested</p>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="training">
                        <div>
                          <h3 className="text-lg font-medium mb-3">Suggested Training & Courses</h3>
                          {analysisResult.skillsGapAnalysis.suggestedTraining.length > 0 ? (
                            <ul className="space-y-2">
                              {analysisResult.skillsGapAnalysis.suggestedTraining.map((training, i) => (
                                <li key={i} className="text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded flex">
                                  <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0" />
                                  <span>{training}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No specific training suggested</p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <p className="text-sm text-gray-500">Confidence: {Math.round(analysisResult.confidenceScore * 100)}%</p>
                    <Button variant="outline" onClick={() => setAnalysisResult(null)}>
                      Close Analysis
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}