import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Search, Upload, Trash2, Eye, Filter, Calendar, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProfileResume {
  id: number;
  filename: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  candidateName: string | null;
  candidateEmail: string | null;
  uploadedAt: string;
  uploadedBy: number;
  extractedText?: string;
  rank?: number;
}

interface SearchResult extends ProfileResume {
  rank: number;
  extractedText: string;
}

export default function ProfileRecord() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewingResume, setViewingResume] = useState<ProfileResume | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch all resumes
  const { data: resumes = [], isLoading } = useQuery<ProfileResume[]>({
    queryKey: ["/api/profile-resumes"],
  });

  // Upload mutation for multiple files
  const uploadMutation = useMutation({
    mutationFn: async (files: { file: File; candidateName: string; candidateEmail: string }[]) => {
      const results = [];
      for (const { file, candidateName, candidateEmail } of files) {
        const formData = new FormData();
        formData.append("resume", file);
        if (candidateName) formData.append("candidateName", candidateName);
        if (candidateEmail) formData.append("candidateEmail", candidateEmail);

        const response = await fetch("/api/profile-resumes/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`${file.name}: ${error.message}`);
        }
        
        const result = await response.json();
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-resumes"] });
      setIsUploadOpen(false);
      setSelectedFiles([]);
      setCandidateName("");
      setCandidateEmail("");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/profile-resumes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-resumes"] });
    },
  });

  // Search function
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/profile-resumes/search/${encodeURIComponent(searchTerm)}`, {
        credentials: "include",
      });
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      } else {
        console.error("Search failed");
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setIsSearching(false);
  };

  // Handle multiple file upload
  const handleUpload = () => {
    if (selectedFiles.length === 0) return;

    const uploadData = selectedFiles.map(file => ({
      file,
      candidateName,
      candidateEmail,
    }));

    uploadMutation.mutate(uploadData);
  };

  // Download resume
  const handleDownload = async (resume: ProfileResume) => {
    try {
      const response = await fetch(`/api/profile-resumes/${resume.id}/download`, {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = resume.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // View resume details
  const handleView = (resume: ProfileResume) => {
    setViewingResume(resume);
    setIsViewDialogOpen(true);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayResumes = searchResults.length > 0 ? searchResults : resumes;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile Record</h1>
            <p className="text-gray-600 mt-1">Search and manage resume database</p>
          </div>
          
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Resume
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Upload Resume Files</DialogTitle>
                <p className="text-sm text-gray-600">Select multiple PDF or DOCX files to upload</p>
              </DialogHeader>
              
              <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                <div className="flex-shrink-0">
                  <Label htmlFor="resume-files">Resume Files (PDF or DOCX)</Label>
                  <Input
                    id="resume-files"
                    type="file"
                    accept=".pdf,.docx"
                    multiple
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    className="mt-1"
                  />
                </div>
                
                {selectedFiles.length > 0 && (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-shrink-0 flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">
                        Selected files ({selectedFiles.length}):
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFiles([])}
                        className="text-xs h-6 px-2"
                      >
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 max-h-60">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border group hover:bg-gray-100 transition-colors">
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="font-medium truncate" title={file.name}>
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatFileSize(file.size)} • {file.type.includes('pdf') ? 'PDF' : 'DOCX'}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const newFiles = selectedFiles.filter((_, i) => i !== index);
                              setSelectedFiles(newFiles);
                            }}
                            className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                            title="Remove file"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex-shrink-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="candidate-name">Default Candidate Name (Optional)</Label>
                      <Input
                        id="candidate-name"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="Applied to all files"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="candidate-email">Default Candidate Email (Optional)</Label>
                      <Input
                        id="candidate-email"
                        type="email"
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                        placeholder="Applied to all files"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleUpload}
                      disabled={selectedFiles.length === 0 || uploadMutation.isPending}
                      className="flex-1"
                      size="lg"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Uploading {selectedFiles.length} file(s)...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload {selectedFiles.length} file(s)
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsUploadOpen(false)}
                      size="lg"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                
                {uploadMutation.error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {uploadMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Content Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder='Advanced search: "Senior Developer" AND React OR Java...'
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? "Searching..." : "Search"}
                </Button>
                {(searchTerm || searchResults.length > 0) && (
                  <Button variant="outline" onClick={clearSearch}>
                    Clear
                  </Button>
                )}
              </div>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>Advanced Search Examples:</strong></p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 font-mono text-xs">
                  <p>• Simple: <code className="bg-gray-100 px-1 rounded">JavaScript React</code></p>
                  <p>• Phrases: <code className="bg-gray-100 px-1 rounded">"Senior Developer" AND React</code></p>
                  <p>• Complex: <code className="bg-gray-100 px-1 rounded">Java AND ("Spring Boot" OR "Spring Framework")</code></p>
                  <p>• Multi-tech: <code className="bg-gray-100 px-1 rounded">("Full Stack" OR "Frontend") AND (React OR Vue)</code></p>
                  <p>• Phone (last 4): <code className="bg-gray-100 px-1 rounded">1234</code></p>
                  <p>• Phone (full): <code className="bg-gray-100 px-1 rounded">5551234567</code></p>
                </div>
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Found <strong>{searchResults.length}</strong> resume(s) matching: <code className="bg-white px-2 py-1 rounded text-xs">{searchTerm}</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results/Resume List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {searchResults.length > 0 ? "Search Results" : "All Resumes"}
              </span>
              <Badge variant="secondary">
                {displayResumes.length} resume(s)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading resumes...</div>
            ) : displayResumes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? `No resumes found for "${searchTerm}"` : "No resumes uploaded yet"}
              </div>
            ) : (
              <div className="space-y-4">
                {displayResumes.map((resume) => (
                  <div key={resume.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-lg">{resume.filename}</h3>
                          <Badge variant={resume.fileType === 'pdf' ? 'default' : 'secondary'}>
                            {resume.fileType.toUpperCase()}
                          </Badge>
                          {resume.rank && (
                            <Badge variant="outline">
                              Relevance: {Math.round(resume.rank * 100)}%
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {resume.candidateName || "Unknown Candidate"}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(resume.uploadedAt)}
                          </div>
                          <div>Size: {formatFileSize(resume.fileSize)}</div>
                        </div>
                        
                        {resume.candidateEmail && (
                          <div className="mt-2 text-sm text-gray-600">
                            Email: {resume.candidateEmail}
                          </div>
                        )}
                        
                        {searchTerm && (resume.highlightedText || resume.extractedText) && (
                          <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                            <p className="text-sm text-gray-700">
                              {resume.highlightedText ? (
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: resume.highlightedText.replace(
                                      /<mark>/g,
                                      '<mark style="background-color: #fbbf24; padding: 2px 4px; border-radius: 3px; font-weight: 600;">'
                                    )
                                  }}
                                />
                              ) : (
                                // Fallback for results without highlighting
                                resume.extractedText && resume.extractedText.length > 200
                                  ? `${resume.extractedText.substring(0, 200)}...`
                                  : resume.extractedText
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(resume)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(resume)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(resume.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Resume Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resume Details</DialogTitle>
            </DialogHeader>
            {viewingResume && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Filename</Label>
                    <p className="text-sm mt-1">{viewingResume.filename}</p>
                  </div>
                  <div>
                    <Label>File Type</Label>
                    <p className="text-sm mt-1">{viewingResume.fileType.toUpperCase()}</p>
                  </div>
                  <div>
                    <Label>Candidate Name</Label>
                    <p className="text-sm mt-1">{viewingResume.candidateName || "Not specified"}</p>
                  </div>
                  <div>
                    <Label>Candidate Email</Label>
                    <p className="text-sm mt-1">{viewingResume.candidateEmail || "Not specified"}</p>
                  </div>
                  <div>
                    <Label>File Size</Label>
                    <p className="text-sm mt-1">{formatFileSize(viewingResume.fileSize)}</p>
                  </div>
                  <div>
                    <Label>Uploaded</Label>
                    <p className="text-sm mt-1">{formatDate(viewingResume.uploadedAt)}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <Label>Extracted Text Content</Label>
                  {searchTerm && viewingResume.highlightedText ? (
                    <div className="mt-2 h-64 overflow-y-auto p-3 border rounded-md bg-gray-50">
                      <div
                        className="text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: viewingResume.highlightedText.replace(
                            /<mark>/g,
                            '<mark style="background-color: #fbbf24; padding: 2px 4px; border-radius: 3px; font-weight: 600;">'
                          )
                        }}
                      />
                    </div>
                  ) : (
                    <Textarea
                      value={viewingResume.extractedText || "No text content available"}
                      readOnly
                      className="mt-2 h-64 resize-none"
                    />
                  )}
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => handleDownload(viewingResume)}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsViewDialogOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}