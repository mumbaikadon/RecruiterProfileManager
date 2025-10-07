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
import { FileText, Download, Search, Upload, Trash2, Eye, Filter, Calendar, User, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
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
  const [uploadMode, setUploadMode] = useState<'sync' | 'async'>('async'); // Default to async
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isTrackingSession, setIsTrackingSession] = useState(false);
  const [viewingResume, setViewingResume] = useState<ProfileResume | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  // Phase 1: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Search metadata for pagination
  const [searchMetadata, setSearchMetadata] = useState<{
    totalCount: number;
    hasMore: boolean;
    pages: number;
  } | null>(null);
  
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

  // Enhanced upload state for progress tracking
  const [uploadProgress, setUploadProgress] = useState({
    currentChunk: 0,
    totalChunks: 0,
    filesCompleted: 0,
    totalFiles: 0,
    isProcessing: false,
    currentChunkFiles: 0,
    failedChunks: [] as any[]
  });

  // Upload mutation with sequential chunk processing for better performance
  const uploadMutation = useMutation({
    mutationFn: async (files: { file: File; candidateName: string; candidateEmail: string }[]) => {
      const startTime = Date.now();
      setUploadProgress({
        currentChunk: 0,
        totalChunks: 0,
        filesCompleted: 0,
        totalFiles: files.length,
        isProcessing: true,
        currentChunkFiles: 0,
        failedChunks: []
      });

      // Sequential chunk processing for better memory usage
      const FRONTEND_CHUNK_SIZE = 5; // 5 files per request for optimal performance
      const chunks = [];
      
      for (let i = 0; i < files.length; i += FRONTEND_CHUNK_SIZE) {
        chunks.push(files.slice(i, i + FRONTEND_CHUNK_SIZE));
      }

      setUploadProgress(prev => ({ 
        ...prev, 
        totalChunks: chunks.length,
        totalFiles: files.length 
      }));

      const aggregatedResults = {
        successful: [] as any[],
        failed: [] as any[],
        total: files.length,
        chunksProcessed: 0,
        failedChunks: [] as any[]
      };

      // Process chunks sequentially to reduce memory overhead
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        setUploadProgress(prev => ({
          ...prev,
          currentChunk: chunkIndex + 1,
          currentChunkFiles: chunk.length
        }));

        try {
          const formData = new FormData();
          chunk.forEach(({ file }) => {
            formData.append('resumes', file);
          });
          
          // Use candidate info from first file
          if (chunk[0]?.candidateName) formData.append('candidateName', chunk[0].candidateName);
          if (chunk[0]?.candidateEmail) formData.append('candidateEmail', chunk[0].candidateEmail);
          
          // For multi-chunk async uploads, pass sessionId to subsequent chunks
          if (uploadMode === 'async' && currentSessionId) {
            formData.append('sessionId', currentSessionId);
            console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} files (Session: ${currentSessionId})`);
          } else {
            console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} files`);
          }
          
          const endpoint = uploadMode === 'async' 
            ? "/api/profile-resumes/bulk-upload-async"
            : "/api/profile-resumes/bulk-upload";
            
          const response = await fetch(endpoint, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
          }
          
          const chunkResult = await response.json();
          
          // Handle async response - store sessionId from first chunk
          if (uploadMode === 'async' && chunkResult.sessionId) {
            if (!currentSessionId) {
              // First chunk - capture sessionId for subsequent chunks
              setCurrentSessionId(chunkResult.sessionId);
              console.log(`✅ Created upload session: ${chunkResult.sessionId}`);
            }
            aggregatedResults.successful.push(...chunkResult.successful);
            aggregatedResults.failed.push(...chunkResult.failed);
            aggregatedResults.chunksProcessed++;
          } else {
            // Aggregate results for sync uploads
            aggregatedResults.successful.push(...chunkResult.successful);
            aggregatedResults.failed.push(...chunkResult.failed);
            aggregatedResults.chunksProcessed++;
          }
          
          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            filesCompleted: aggregatedResults.successful.length
          }));
          
          // Brief delay between chunks to prevent server overload
          if (chunkIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
        } catch (error) {
          console.error(`Chunk ${chunkIndex + 1} failed:`, error);
          
          // Add failed chunk for retry capability
          const failedChunk = {
            id: chunkIndex,
            files: chunk,
            error: (error as Error).message
          };
          
          aggregatedResults.failedChunks.push(failedChunk);
          
          // Mark individual files as failed initially (will retry)
          const chunkFailures = chunk.map(fileData => ({
            filename: fileData.file.name,
            error: (error as Error).message
          }));
          aggregatedResults.failed.push(...chunkFailures);
        }
      }

      // Retry failed chunks once
      if (aggregatedResults.failedChunks.length > 0) {
        console.log(`Retrying ${aggregatedResults.failedChunks.length} failed chunks...`);
        
        setUploadProgress(prev => ({
          ...prev,
          currentChunk: 0,
          totalChunks: aggregatedResults.failedChunks.length
        }));

        for (let retryIndex = 0; retryIndex < aggregatedResults.failedChunks.length; retryIndex++) {
          const failedChunk = aggregatedResults.failedChunks[retryIndex];
          
          setUploadProgress(prev => ({
            ...prev,
            currentChunk: retryIndex + 1
          }));

          try {
            const formData = new FormData();
            failedChunk.files.forEach(({ file }: any) => {
              formData.append('resumes', file);
            });
            
            if (failedChunk.files[0]?.candidateName) formData.append('candidateName', failedChunk.files[0].candidateName);
            if (failedChunk.files[0]?.candidateEmail) formData.append('candidateEmail', failedChunk.files[0].candidateEmail);
            
            // For async mode, include sessionId in retry
            if (uploadMode === 'async' && currentSessionId) {
              formData.append('sessionId', currentSessionId);
              console.log(`Retrying async chunk ${retryIndex + 1}/${aggregatedResults.failedChunks.length} (Session: ${currentSessionId})`);
            } else {
              console.log(`Retrying chunk ${retryIndex + 1}/${aggregatedResults.failedChunks.length}`);
            }
            
            // Use appropriate endpoint based on upload mode
            const retryEndpoint = uploadMode === 'async' 
              ? "/api/profile-resumes/bulk-upload-async"
              : "/api/profile-resumes/bulk-upload";
            
            const response = await fetch(retryEndpoint, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
            
            if (response.ok) {
              const retryResult = await response.json();
              
              // Remove from failed and add to successful
              const failedFileNames = failedChunk.files.map((f: any) => f.file.name);
              aggregatedResults.failed = aggregatedResults.failed.filter(f => !failedFileNames.includes(f.filename));
              aggregatedResults.successful.push(...retryResult.successful);
              
              console.log(`Retry successful for chunk ${retryIndex + 1}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (retryError) {
            console.error(`Retry failed for chunk ${retryIndex + 1}:`, retryError);
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Optimized bulk upload completed in ${duration}ms. Success: ${aggregatedResults.successful.length}, Failed: ${aggregatedResults.failed.length}`);
      
      setUploadProgress(prev => ({ ...prev, isProcessing: false }));
      return aggregatedResults;
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
      // For async uploads, enable session tracking after all chunks complete
      if (uploadMode === 'async' && currentSessionId) {
        setIsTrackingSession(true);
        console.log(`✅ All chunks uploaded. Tracking session: ${currentSessionId}`);
      }
      
      // Invalidate and refetch to get the real data from server
      queryClient.invalidateQueries({ queryKey: ["/api/profile-resumes"] });
      queryClient.refetchQueries({ queryKey: ["/api/profile-resumes"] });
      
      setIsUploadOpen(false);
      setSelectedFiles([]);
      setCandidateName("");
      setCandidateEmail("");
      
      const { successful, failed } = result;
      
      const successMsg = `Successfully uploaded ${successful.length} resume(s)`;
      const failMsg = failed.length > 0 ? `, ${failed.length} failed` : '';
      
      // Determine alert type based on results
      if (successful.length > 0 || failed.length > 0) {
        const isSuccess = successful.length > 0;
        const hasFailures = failed.length > 0;
        
        let alertType, alertMessage;
        
        if (isSuccess && !hasFailures) {
          // All successful
          alertType = 'bg-green-500';
          alertMessage = successMsg;
        } else if (isSuccess && hasFailures) {
          // Mixed results
          alertType = 'bg-yellow-500';
          alertMessage = `Partial success: ${successMsg}${failMsg}`;
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
      setSearchMetadata({
        totalCount: data.metadata.totalCount,
        hasMore: data.pagination.hasMore,
        pages: data.pagination.pages
      });
      setIsSearching(false);
      console.log(`Snippet search completed: ${data.results?.length || 0} results (${data.metadata.totalCount} total)`);
    },
    onError: (error) => {
      console.error("Search failed:", error);
      setSearchResults([]);
      setIsSearching(false);
    }
  });
  
  // Session tracking for async uploads
  const { data: sessionStatus } = useQuery({
    queryKey: ['upload-session', currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) return null;
      const response = await fetch(`/api/upload-sessions/${currentSessionId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch session status');
      return response.json();
    },
    enabled: !!currentSessionId && isTrackingSession,
    refetchInterval: 2000, // Poll every 2 seconds
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
      
      if (response.status === 202) {
        // Resume is still being processed
        const data = await response.json();
        throw new Error(data.message || 'Resume is still being processed. Please wait a moment and try again.');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load resume content');
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
  
  // Phase 1: Handle view resume - show dialog with preview only (button-controlled loading)
  const handleViewResume = (resume: ProfileResume | SearchResult) => {
    setViewingResume(resume);
    setIsViewDialogOpen(true);
    // Content now loads only when user clicks "Load Full Content" button
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setSearchMetadata(null);
    setSearchPage(1);
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
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="uploadMode"
                        value="async"
                        checked={uploadMode === 'async'}
                        onChange={(e) => setUploadMode(e.target.value as 'async')}
                        className="text-blue-600"
                      />
                      <div>
                        <span className="font-medium text-blue-800">⚡ Async Upload (Recommended)</span>
                        <p className="text-xs text-blue-600">Queue files for background processing - upload 500+ files instantly!</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="uploadMode"
                        value="sync"
                        checked={uploadMode === 'sync'}
                        onChange={(e) => setUploadMode(e.target.value as 'sync')}
                        className="text-blue-600"
                      />
                      <div>
                        <span className="font-medium text-blue-800">🔄 Sync Upload</span>
                        <p className="text-xs text-blue-600">Process files immediately - wait for completion</p>
                      </div>
                    </label>
                  </div>
                </div>
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
                      disabled={selectedFiles.length === 0 || uploadProgress.isProcessing}
                      className="flex-1"
                      size="lg"
                    >
                      {uploadProgress.isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          {uploadProgress.currentChunk === 0 ? 
                            `Preparing ${selectedFiles.length} file(s)...` : 
                            `Processing chunk ${uploadProgress.currentChunk}/${uploadProgress.totalChunks}...`
                          }
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadMode === 'async' ? `⚡ Queue ${selectedFiles.length} file(s)` : `🔄 Process ${selectedFiles.length} file(s)`}
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
                
                {uploadProgress.isProcessing && (
                  <Alert>
                    <AlertDescription>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                          <span>
                            {uploadProgress.currentChunk === 0 ? 
                              "Preparing upload..." : 
                              `Processing chunk ${uploadProgress.currentChunk} of ${uploadProgress.totalChunks} (${uploadProgress.currentChunkFiles} files)`
                            }
                          </span>
                        </div>
                        
                        {uploadProgress.totalChunks > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-600">
                              <span>{uploadProgress.filesCompleted} / {uploadProgress.totalFiles} files completed</span>
                              <span>{Math.round((uploadProgress.filesCompleted / uploadProgress.totalFiles) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${(uploadProgress.filesCompleted / uploadProgress.totalFiles) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {uploadProgress.failedChunks.length > 0 && (
                          <div className="text-sm text-yellow-600">
                            ⚠️ {uploadProgress.failedChunks.length} chunk(s) failed - will retry automatically
                          </div>
                        )}
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
                <Button onClick={() => handleSearch()} disabled={isSearching}>
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
            
            {searchResults.length > 0 && searchMetadata && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Showing <strong>{((searchPage - 1) * itemsPerPage) + 1}-{Math.min(searchPage * itemsPerPage, searchMetadata.totalCount)}</strong> of <strong>{searchMetadata.totalCount}</strong> resume(s) matching: <code className="bg-white px-2 py-1 rounded text-xs">{searchTerm}</code>
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
                {searchResults.length > 0 && searchMetadata 
                  ? `${displayResumes.length} of ${searchMetadata.totalCount} resume(s)`
                  : `${displayResumes.length} resume(s)`
                }
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
                          title="View resume details"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(resume)}
                          title="Download resume file"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(resume.id)}
                          disabled={deleteMutation.isPending}
                          title="Delete resume"
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
        
        {/* Pagination Controls */}
        {(displayResumes.length > 0 && (searchResults.length > 0 ? searchMetadata && searchMetadata.pages > 1 : pagination && pagination.pages > 1)) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {searchResults.length > 0 && searchMetadata ? (
                    <>Showing {((searchPage - 1) * itemsPerPage) + 1}-{Math.min(searchPage * itemsPerPage, searchMetadata.totalCount)} of {searchMetadata.totalCount} results</>
                  ) : (
                    pagination && <>Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} resumes</>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Previous Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (searchResults.length > 0) {
                        if (searchPage > 1) handleSearch(searchPage - 1);
                      } else {
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }
                    }}
                    disabled={searchResults.length > 0 ? searchPage <= 1 : currentPage <= 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  {/* Page Numbers */}
                  {searchResults.length > 0 && searchMetadata ? (
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, searchMetadata.pages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === searchPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSearch(pageNum)}
                            className="w-10 h-8"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {searchMetadata.pages > 5 && (
                        <span className="text-gray-500">...</span>
                      )}
                    </div>
                  ) : (
                    pagination && (
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              disabled={isLoading}
                              className="w-10 h-8"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                        {pagination.pages > 5 && (
                          <span className="text-gray-500">...</span>
                        )}
                      </div>
                    )
                  )}
                  
                  {/* Next Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (searchResults.length > 0) {
                        if (searchMetadata && searchPage < searchMetadata.pages) handleSearch(searchPage + 1);
                      } else {
                        if (pagination && currentPage < pagination.pages) setCurrentPage(currentPage + 1);
                      }
                    }}
                    disabled={
                      searchResults.length > 0 
                        ? !searchMetadata || searchPage >= searchMetadata.pages
                        : !pagination || currentPage >= pagination.pages || isLoading
                    }
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Async Upload Session Tracking */}
        {isTrackingSession && sessionStatus && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  <span>⚡ Background Processing</span>
                </div>
                {sessionStatus.progress && (
                  <Badge variant="outline" className="ml-auto">
                    {sessionStatus.progress.percentage}% Complete
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessionStatus.progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Processing {sessionStatus.progress.total} files</span>
                      <span>{sessionStatus.progress.completed + sessionStatus.progress.failed} / {sessionStatus.progress.total} processed</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${sessionStatus.progress.percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>✅ {sessionStatus.progress.completed} completed</span>
                      <span>⌛ {sessionStatus.progress.processing} processing</span>
                      <span>⏳ {sessionStatus.progress.pending} pending</span>
                      {sessionStatus.progress.failed > 0 && (
                        <span className="text-red-600">❌ {sessionStatus.progress.failed} failed</span>
                      )}
                    </div>
                  </div>
                )}
                
                {sessionStatus.progress?.percentage === 100 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="font-medium">Processing Complete!</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsTrackingSession(false);
                        setCurrentSessionId(null);
                        queryClient.invalidateQueries({ queryKey: ["/api/profile-resumes"] });
                      }}
                    >
                      Done
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                  ) : viewingResume.processingStatus === 'failed' ? (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold">Processing Failed</p>
                        <p className="text-sm mt-1">This resume could not be processed. The file may be corrupted or in an unsupported format. Please try re-uploading the file.</p>
                      </AlertDescription>
                    </Alert>
                  ) : viewingResume.processingStatus === 'uploading' || viewingResume.processingStatus === 'processing' ? (
                    <div className="mt-2 h-64 flex items-center justify-center border rounded-md bg-blue-50">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-blue-600">
                          {viewingResume.processingStatus === 'uploading' ? 'Uploading and queuing resume...' : 'Processing resume in background...'}
                        </p>
                        <p className="text-xs text-blue-500 mt-1">Content will be available soon. Please refresh.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 h-64 flex items-center justify-center border rounded-md bg-gray-50">
                      <div className="text-center">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">Click "Load Full Content" to view complete text</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await loadResumeContent(viewingResume.id);
                            } catch (error) {
                              // Show error alert
                              const alert = document.createElement('div');
                              alert.className = 'fixed top-4 right-4 bg-yellow-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-md';
                              alert.textContent = (error as Error).message;
                              document.body.appendChild(alert);
                              
                              setTimeout(() => {
                                if (document.body.contains(alert)) {
                                  document.body.removeChild(alert);
                                }
                              }, 5000);
                            }
                          }}
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