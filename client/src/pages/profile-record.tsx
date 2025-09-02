// This is a corrected version with the three-phase upload system

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileUp, Search, X, Download, Trash2, User, Mail, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface ProfileResume {
  id: number;
  filename: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  candidateName: string | null;
  candidateEmail: string | null;
  uploadedAt: string;
  uploadedBy: number;
  extractedText: string;
}

export default function ProfileRecord() {
  const queryClient = useQueryClient();
  
  // States for file upload
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  
  // States for search and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(25);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Query to fetch resumes with search and pagination
  const resumesResponse = useQuery({
    queryKey: ["/api/profile-resumes", { search: searchTerm, page: currentPage, limit: resultsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: resultsPerPage.toString()
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
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
  const resumes = resumesResponse?.data?.resumes || [];
  const pagination = resumesResponse?.data?.pagination;

  // Enhanced upload mutation with three-phase system
  const uploadMutation = useMutation({
    mutationFn: async (files: { file: File; candidateName: string; candidateEmail: string }[]) => {
      const startTime = Date.now();
      const LARGE_BATCH_THRESHOLD = 10; // Use fast upload for 10+ files
      
      setUploadProgress({
        currentChunk: 0,
        totalChunks: 0,
        filesCompleted: 0,
        totalFiles: files.length,
        isProcessing: true,
        currentChunkFiles: 0,
        failedChunks: []
      });

      // Choose upload strategy based on batch size
      if (files.length >= LARGE_BATCH_THRESHOLD) {
        // Fast Upload for large batches
        console.log(`Large batch detected (${files.length} files), using fast upload system...`);
        
        const formData = new FormData();
        files.forEach(({ file }) => {
          formData.append('resumes', file);
        });
        
        if (files[0]?.candidateName) formData.append('candidateName', files[0].candidateName);
        if (files[0]?.candidateEmail) formData.append('candidateEmail', files[0].candidateEmail);
        
        const response = await fetch("/api/profile-resumes/fast-upload", {
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
          isFastUpload: true,
          message: `Files uploaded successfully! Background processing will extract text and create profile records automatically.`
        };

      } else {
        // Traditional bulk upload for smaller batches
        console.log(`Small batch (${files.length} files), using traditional bulk upload...`);
        
        const formData = new FormData();
        files.forEach(({ file }) => {
          formData.append('resumes', file);
        });
        
        if (files[0]?.candidateName) formData.append('candidateName', files[0].candidateName);
        if (files[0]?.candidateEmail) formData.append('candidateEmail', files[0].candidateEmail);
        
        const response = await fetch("/api/profile-resumes/bulk-upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
        }
        
        return response.json();
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-resumes"] });
      setIsUploadOpen(false);
      setSelectedFiles([]);
      setCandidateName("");
      setCandidateEmail("");
      setUploadProgress(prev => ({ ...prev, isProcessing: false }));
      
      const { successful, failed } = result;
      const message = result.isFastUpload 
        ? result.message 
        : `Successfully uploaded ${successful.length} resume(s)${failed?.length > 0 ? `, ${failed.length} failed` : ''}`;
      
      // Show success message
      const alert = document.createElement('div');
      alert.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50';
      alert.textContent = message;
      document.body.appendChild(alert);
      
      setTimeout(() => {
        if (document.body.contains(alert)) {
          document.body.removeChild(alert);
        }
      }, 4000);
    },
    onError: (error: Error) => {
      setUploadProgress(prev => ({ ...prev, isProcessing: false }));
      console.error('Upload error:', error);
    }
  });

  // File selection handling
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    
    const fileData = selectedFiles.map(file => ({
      file,
      candidateName,
      candidateEmail
    }));
    
    uploadMutation.mutate(fileData);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Record Management
            </CardTitle>
            <CardDescription>
              Manage candidate resume database with advanced search and bulk upload capabilities
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileUp className="h-4 w-4 mr-2" />
              Upload Resumes
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Resume Files</DialogTitle>
              <DialogDescription>
                Upload multiple PDF or DOCX files. Large batches (10+ files) will use fast upload with background processing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="candidateName">Candidate Name (Optional)</Label>
                  <Input
                    id="candidateName"
                    placeholder="Enter candidate name"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="candidateEmail">Candidate Email (Optional)</Label>
                  <Input
                    id="candidateEmail"
                    type="email"
                    placeholder="Enter candidate email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Files</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files ({selectedFiles.length})</Label>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1 truncate">
                          <span className="text-sm font-medium">{file.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({formatFileSize(file.size)})</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadProgress.isProcessing && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processing files...</span>
                        <span>{uploadProgress.filesCompleted}/{uploadProgress.totalFiles}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${(uploadProgress.filesCompleted / uploadProgress.totalFiles) * 100}%` }}
                        />
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={selectedFiles.length === 0 || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload Files"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search and Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search resumes by content, name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {resumesResponse.isLoading ? (
              <div className="text-center py-8">Loading resumes...</div>
            ) : resumes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No resumes found. Upload some files to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {resumes.map((resume: ProfileResume) => (
                  <Card key={resume.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{resume.filename}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {resume.candidateName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {resume.candidateName}
                            </span>
                          )}
                          {resume.candidateEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {resume.candidateEmail}
                            </span>
                          )}
                          <span>{formatFileSize(resume.fileSize)}</span>
                          <Badge variant="secondary">{resume.fileType.toUpperCase()}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}