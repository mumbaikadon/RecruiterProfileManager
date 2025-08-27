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

// Phase 1: Optimized interfaces - NO FULL TEXT!
interface ProfileResume {
  id: number;
  filename: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  candidateName: string | null;
  candidateEmail: string | null;
  processingStatus?: string;
  uploadedAt: string;
  uploadedBy: number;
  summaryText?: string; // Short summary instead of full text
  filePath?: string;
}

interface PaginatedResponse<T> {
  resumes?: T[];
  results?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    pages: number;
  };
  metadata: {
    searchQuery?: string | null;
    resultCount: number;
    totalCount: number;
    duration: number;
  };
}

interface SearchResult extends ProfileResume {
  rank: number;
  snippets: string; // Only snippets, not full text!
  highlightedSnippets: string;
}

interface ResumeContent {
  extractedText: string;
  wordCount?: number;
  metadata: {
    duration: number;
    textLength: number;
    compressed: boolean;
  };
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
  
  // Phase 1: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Phase 1: Content loading state  
  const [loadingContent, setLoadingContent] = useState<number | null>(null);
  const [resumeContent, setResumeContent] = useState<{[key: number]: ResumeContent}>({});

  const queryClient = useQueryClient();

  // Phase 1: Fetch resumes with pagination (NO FULL TEXT!)
  const { data: resumesResponse, isLoading } = useQuery<PaginatedResponse<ProfileResume>>({
    queryKey: ["/api/profile-resumes", currentPage, itemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        includeFileData: 'false' // Exclude file data for list view
      });
      
      const response = await fetch(`/api/profile-resumes?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }
      
      return response.json();
    }
  });

  // Extract resumes and pagination info
  const resumes = resumesResponse?.resumes || [];
  const pagination = resumesResponse?.pagination;

  // Upload mutation for multiple files with real-time updates
  const uploadMutation = useMutation({
    mutationFn: async (files: { file: File; candidateName: string; candidateEmail: string }[]) => {
      // Step 1: Check for duplicates
      const filenames = files.map(f => f.file.name);
      const duplicateResponse = await fetch("/api/profile-resumes/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames }),
        credentials: "include",
      });
      
      if (!duplicateResponse.ok) {
        throw new Error("Failed to check for duplicates");
      }
      
      const { duplicates } = await duplicateResponse.json();
      
      // Step 2: Filter out duplicates
      const newFiles = files.filter(fileData => !duplicates.includes(fileData.file.name));
      
      if (duplicates.length > 0) {
        console.log(`Removed ${duplicates.length} duplicate files:`, duplicates);
      }

      if (newFiles.length === 0) {
        return { 
          successful: [], 
          failed: [], 
          total: files.length,
          duplicatesRemoved: duplicates.length,
          message: "All files already exist in database"
        };
      }

      // Step 3: Bulk upload remaining files
      const formData = new FormData();
      newFiles.forEach(({ file }) => {
        formData.append('resumes', file);
      });
      
      // Use the candidate name/email from the first file (they should all be the same)
      if (newFiles[0]?.candidateName) formData.append('candidateName', newFiles[0].candidateName);
      if (newFiles[0]?.candidateEmail) formData.append('candidateEmail', newFiles[0].candidateEmail);
      
      const response = await fetch("/api/profile-resumes/bulk-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      const result = await response.json();
      return {
        ...result,
        duplicatesRemoved: duplicates.length
      };
    },
    onMutate: async (files) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/profile-resumes"] });

      // Snapshot the previous value
      const previousResumes = queryClient.getQueryData<ProfileResume[]>(["/api/profile-resumes"]);

      // Optimistically add the uploading files to the list
      if (previousResumes) {
        const optimisticResumes = files.map((fileData, index) => ({
          id: -index - 1, // Temporary negative ID
          filename: fileData.file.name,
          fileType: fileData.file.name.endsWith('.pdf') ? 'pdf' as const : 'docx' as const,
          fileSize: fileData.file.size,
          candidateName: fileData.candidateName || null,
          candidateEmail: fileData.candidateEmail || null,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 2, // Current user ID
          extractedText: "Processing...",
        }));

        queryClient.setQueryData<ProfileResume[]>(
          ["/api/profile-resumes"],
          [...optimisticResumes, ...previousResumes]
        );
      }

      // Return a context object with the snapshotted value
      return { previousResumes };
    },
    onError: (err, files, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousResumes) {
        queryClient.setQueryData(["/api/profile-resumes"], context.previousResumes);
      }
    },
    onSuccess: (result) => {
      // Invalidate and refetch to get the real data from server
      queryClient.invalidateQueries({ queryKey: ["/api/profile-resumes"] });
      queryClient.refetchQueries({ queryKey: ["/api/profile-resumes"] });
      
      setIsUploadOpen(false);
      setSelectedFiles([]);
      setCandidateName("");
      setCandidateEmail("");
      
      const { successful, failed, duplicatesRemoved, message } = result;
      
      if (message) {
        // All files were duplicates
        console.log(message);
      } else {
        const successMsg = `Successfully uploaded ${successful.length} resume(s)`;
        const duplicateMsg = duplicatesRemoved > 0 ? ` (${duplicatesRemoved} duplicates removed)` : '';
        const failMsg = failed.length > 0 ? `, ${failed.length} failed` : '';
        
        // Determine alert type based on results
        const isSuccess = successful.length > 0;
        const hasFailures = failed.length > 0;
        
        let alertType, alertMessage;
        
        if (isSuccess && !hasFailures) {
          // All successful
          alertType = 'bg-green-500';
          alertMessage = successMsg + duplicateMsg;
        } else if (isSuccess && hasFailures) {
          // Mixed results
          alertType = 'bg-yellow-500';
          alertMessage = `Partial success: ${successMsg}${duplicateMsg}${failMsg}`;
        } else {
          // All failed
          alertType = 'bg-red-500';
          alertMessage = `Upload failed: ${failed.length} file(s) could not be processed`;
        }
        
        // Create a toast or alert with appropriate styling
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 ${alertType} text-white p-4 rounded-lg shadow-lg z-50`;
        alert.textContent = alertMessage;
        document.body.appendChild(alert);
        
        // Remove alert after 4 seconds for better readability
        setTimeout(() => {
          if (document.body.contains(alert)) {
            document.body.removeChild(alert);
          }
        }, 4000);
      }
    },
  });

  // Delete mutation with optimistic updates
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
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/profile-resumes"] });

      // Snapshot the previous value
      const previousResumes = queryClient.getQueryData<ProfileResume[]>(["/api/profile-resumes"]);

      // Optimistically update to the new value
      if (previousResumes) {
        queryClient.setQueryData<ProfileResume[]>(
          ["/api/profile-resumes"],
          previousResumes.filter(resume => resume.id !== deletedId)
        );
      }

      // Return a context object with the snapshotted value
      return { previousResumes };
    },
    onError: (err, deletedId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousResumes) {
        queryClient.setQueryData(["/api/profile-resumes"], context.previousResumes);
      }
    },
    onSuccess: () => {
      // Show success notification
      const alert = document.createElement('div');
      alert.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50';
      alert.textContent = 'Resume deleted successfully';
      document.body.appendChild(alert);
      
      setTimeout(() => {
        if (document.body.contains(alert)) {
          document.body.removeChild(alert);
        }
      }, 2000);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/profile-resumes"] });
    },
  });

  // Phase 1: CRITICAL - Snippet-based search (MASSIVE memory savings!)
  const searchMutation = useMutation({
    mutationFn: async ({ query, page }: { query: string; page: number }) => {
      console.log("Starting snippet search for:", query, "page:", page);
      const response = await fetch('/api/profile-resumes/search-snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          searchTerm: query,
          page,
          limit: itemsPerPage,
          maxSnippetLength: 75 // Limit snippet size for performance
        })
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      return response.json() as Promise<PaginatedResponse<SearchResult>>;
    },
    onMutate: () => {
      setIsSearching(true);
    },
    onSuccess: (data) => {
      setSearchResults(data.results || []);
      setIsSearching(false);
      console.log(`Snippet search completed: ${data.results?.length || 0} results (${data.metadata.totalCount} total)`);
    },
    onError: (error) => {
      console.error("Search failed:", error);
      setSearchResults([]);
      setIsSearching(false);
    }
  });
  
  // Phase 1: Load full content ONLY when viewing (on-demand)
  const loadResumeContent = async (id: number) => {
    if (resumeContent[id]) {
      return resumeContent[id]; // Already loaded
    }
    
    setLoadingContent(id);
    
    try {
      const response = await fetch(`/api/profile-resumes/${id}/content`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load resume content');
      }
      
      const content = await response.json() as ResumeContent;
      setResumeContent(prev => ({ ...prev, [id]: content }));
      return content;
    } catch (error) {
      console.error('Failed to load content:', error);
      throw error;
    } finally {
      setLoadingContent(null);
    }
  };

  // Phase 1: Updated search handler for pagination
  const handleSearch = async (page: number = 1) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setSearchPage(page);
    searchMutation.mutate({ query: searchTerm.trim(), page });
  };
  
  // Phase 1: Handle view resume with on-demand content loading
  const handleViewResume = async (resume: ProfileResume | SearchResult) => {
    setViewingResume(resume);
    setIsViewDialogOpen(true);
    
    // Load full content asynchronously
    try {
      await loadResumeContent(resume.id);
    } catch (error) {
      console.error('Failed to load resume content:', error);
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
                          Processing {selectedFiles.length} file(s)...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Smart Upload {selectedFiles.length} file(s)
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
                
                {uploadMutation.isPending && (
                  <Alert>
                    <AlertDescription>
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        <span>Checking for duplicates and processing files in parallel chunks...</span>
                      </div>
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
                        
                        {/* Phase 1: Show snippets for search results (memory optimized!) */}
                        {'snippets' in resume && resume.snippets && (
                          <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                            <p className="text-sm text-gray-700">
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: (resume.highlightedSnippets || resume.snippets).replace(
                                    /<mark>/g,
                                    '<mark style="background-color: #fbbf24; padding: 2px 4px; border-radius: 3px; font-weight: 600;">'
                                  )
                                }}
                              />
                            </p>
                            {'rank' in resume && (
                              <div className="mt-2 text-xs text-yellow-700">
                                Match Score: {(resume.rank * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Phase 1: Show summary for regular results */}
                        {!('snippets' in resume) && resume.summaryText && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Summary:</span> {resume.summaryText}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewResume(resume)}
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
                  {/* Phase 1: On-demand content loading */}
                  {loadingContent === viewingResume.id ? (
                    <div className="mt-2 h-64 flex items-center justify-center border rounded-md bg-gray-50">
                      <div className="text-center">
                        <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Loading full content...</p>
                      </div>
                    </div>
                  ) : resumeContent[viewingResume.id] ? (
                    <div className="mt-2">
                      <div className="mb-2 text-xs text-gray-500 flex justify-between">
                        <span>Word Count: {resumeContent[viewingResume.id].wordCount || 'Unknown'}</span>
                        <span>Load Time: {resumeContent[viewingResume.id].metadata.duration}ms</span>
                      </div>
                      <Textarea
                        value={resumeContent[viewingResume.id].extractedText}
                        readOnly
                        className="h-64 resize-none text-sm"
                        placeholder="Full resume content..."
                      />
                    </div>
                  ) : (
                    <div className="mt-2 h-64 flex items-center justify-center border rounded-md bg-gray-50">
                      <div className="text-center">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">Click "Load Full Content" to view complete text</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadResumeContent(viewingResume.id)}
                        >
                          Load Full Content
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Phase 1: Show snippets if available */}
                  {'snippets' in viewingResume && viewingResume.snippets && (
                    <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <Label className="text-xs text-yellow-800">Search Match Snippets:</Label>
                      <div 
                        className="text-sm mt-1"
                        dangerouslySetInnerHTML={{
                          __html: viewingResume.highlightedSnippets || viewingResume.snippets
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Phase 1: Show summary if available */}
                  {viewingResume.summaryText && (
                    <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                      <Label className="text-xs text-blue-800">Summary:</Label>
                      <p className="text-sm mt-1 text-blue-700">{viewingResume.summaryText}</p>
                    </div>
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