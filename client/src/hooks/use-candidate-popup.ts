import { useState } from 'react';

interface CandidatePopupState {
  isOpen: boolean;
  candidateId: number | null;
}

export const useCandidatePopup = () => {
  const [state, setState] = useState<CandidatePopupState>({
    isOpen: false,
    candidateId: null
  });

  const openPopup = (candidateId: number) => {
    setState({
      isOpen: true,
      candidateId
    });
  };

  const closePopup = () => {
    setState({
      isOpen: false,
      candidateId: null
    });
  };

  return {
    isOpen: state.isOpen,
    candidateId: state.candidateId,
    openPopup,
    closePopup
  };
};