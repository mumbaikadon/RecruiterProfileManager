import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface PdfReprocessButtonProps {
  candidateId: number;
  onSuccess?: () => void;
}

export function PdfReprocessButton({ candidateId, onSuccess }: PdfReprocessButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReprocess = async () => {
    setIsProcessing(true);
    
    try {
      const response = await fetch(`/api/reprocess-pdf/${candidateId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "PDF Reprocessed Successfully",
          description: `Extracted ${result.textLength} characters from PDF resume`
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "Reprocessing Failed",
          description: result.message || "Failed to reprocess PDF",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("PDF reprocessing error:", error);
      toast({
        title: "Error",
        description: "An error occurred while reprocessing the PDF",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      onClick={handleReprocess}
      disabled={isProcessing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
      {isProcessing ? 'Reprocessing...' : 'Reprocess PDF'}
    </Button>
  );
}