import { useState, useEffect } from "react";

/**
 * Custom hook for checking if a media query matches
 * @param query CSS media query string
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with the current match state if possible, or default to undefined
  const getMatches = (query: string): boolean => {
    // Check if window is available (for SSR compatibility)
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(getMatches(query));

  // Handle change event and cleanup
  useEffect(() => {
    // Bail if no window
    if (typeof window === 'undefined') {
      return undefined;
    }
    
    const mediaQuery = window.matchMedia(query);
    
    // Update the state
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    
    // Add event listener for state updates
    mediaQuery.addEventListener('change', handler);
    
    // Set initial value
    setMatches(mediaQuery.matches);
    
    // Cleanup
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}