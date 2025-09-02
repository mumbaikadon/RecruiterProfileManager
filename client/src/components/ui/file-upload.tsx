import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = ".pdf,.doc,.docx",
  maxSize = 5242880, // 5MB
  onFileChange,
  disabled = false,
  className,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setError(null);

    if (!selectedFile) {
      setFile(null);
      onFileChange(null);
      return;
    }

    // Check file size
    if (selectedFile.size > maxSize) {
      setError(`File size must be less than ${formatFileSize(maxSize)}`);
      setFile(null);
      onFileChange(null);
      return;
    }

    setFile(selectedFile);
    onFileChange(selectedFile);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    onFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
        disabled={disabled}
      />

      {!file ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-accent/5 transition-colors",
            error ? "border-destructive" : "border-border",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={disabled ? undefined : handleButtonClick}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            {accept
              .split(",")
              .map((ext) => ext.replace(".", "").toUpperCase())
              .join(", ")}{" "}
            (Max {formatFileSize(maxSize)})
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 border rounded-md">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div className="text-sm truncate max-w-[240px]">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveFile}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};