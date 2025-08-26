import React from "react";
import { useCandidatePopup } from "@/hooks/use-candidate-popup";
import { useCandidate } from "@/hooks/use-candidates";
import CandidateProfilePopup from "./candidate-profile-popup";
import { Button } from "@/components/ui/button";

// Example integration component showing how to use the popup
const CandidateProfileIntegrationExample: React.FC = () => {
  const { isOpen, candidateId, openPopup, closePopup } = useCandidatePopup();
  
  // Fetch candidate data when popup is opened
  const { data: candidate } = useCandidate(candidateId || 0, {
    enabled: !!candidateId && isOpen
  });

  const handleCandidateClick = (id: number) => {
    openPopup(id);
  };

  return (
    <div>
      {/* Example trigger buttons - replace with your actual UI */}
      <div className="space-y-2">
        <Button onClick={() => handleCandidateClick(1)}>
          View Candidate 1 Profile
        </Button>
        <Button onClick={() => handleCandidateClick(2)}>
          View Candidate 2 Profile
        </Button>
      </div>

      {/* The responsive popup */}
      <CandidateProfilePopup
        isOpen={isOpen}
        onClose={closePopup}
        candidate={candidate}
      />
    </div>
  );
};

export default CandidateProfileIntegrationExample;

/* 
  HOW TO INTEGRATE INTO YOUR EXISTING COMPONENTS:

  1. In any table row or component where you want to show candidate profiles:
  
  import { useCandidatePopup } from "@/hooks/use-candidate-popup";
  import { useCandidate } from "@/hooks/use-candidates";
  import CandidateProfilePopup from "@/components/candidate/candidate-profile-popup";

  2. In your component:
  
  const { isOpen, candidateId, openPopup, closePopup } = useCandidatePopup();
  const { data: candidate } = useCandidate(candidateId || 0, {
    enabled: !!candidateId && isOpen
  });

  3. Add click handler to your table rows or buttons:
  
  <TableRow onClick={() => openPopup(candidate.id)}>
    // ... table content
  </TableRow>

  4. Add the popup component to your JSX:
  
  <CandidateProfilePopup
    isOpen={isOpen}
    onClose={closePopup}
    candidate={candidate}
  />

  RESPONSIVE BEHAVIOR:
  - Desktop (lg+): Right sidebar overlay
  - Tablet (md): Center modal
  - Mobile (sm): Bottom sheet
  - All sizes include backdrop and smooth animations
  - Touch-friendly with proper tap targets
  - Scrollable content area
  - Accessible with keyboard navigation
*/