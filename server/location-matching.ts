/**
 * Location Matching Module
 * 
 * This module provides enhanced location matching capabilities for job recommendations,
 * including geographic proximity, time zone compatibility, and commute considerations.
 */

// US states with their time zones
export const statesToTimeZones: Record<string, string[]> = {
  "AL": ["America/Chicago"],
  "AK": ["America/Anchorage", "America/Adak"],
  "AZ": ["America/Phoenix"],
  "AR": ["America/Chicago"],
  "CA": ["America/Los_Angeles"],
  "CO": ["America/Denver"],
  "CT": ["America/New_York"],
  "DE": ["America/New_York"],
  "FL": ["America/New_York", "America/Chicago"],
  "GA": ["America/New_York"],
  "HI": ["Pacific/Honolulu"],
  "ID": ["America/Denver", "America/Los_Angeles"],
  "IL": ["America/Chicago"],
  "IN": ["America/New_York", "America/Chicago"],
  "IA": ["America/Chicago"],
  "KS": ["America/Chicago", "America/Denver"],
  "KY": ["America/New_York", "America/Chicago"],
  "LA": ["America/Chicago"],
  "ME": ["America/New_York"],
  "MD": ["America/New_York"],
  "MA": ["America/New_York"],
  "MI": ["America/New_York", "America/Chicago"],
  "MN": ["America/Chicago"],
  "MS": ["America/Chicago"],
  "MO": ["America/Chicago"],
  "MT": ["America/Denver"],
  "NE": ["America/Chicago", "America/Denver"],
  "NV": ["America/Los_Angeles", "America/Denver"],
  "NH": ["America/New_York"],
  "NJ": ["America/New_York"],
  "NM": ["America/Denver"],
  "NY": ["America/New_York"],
  "NC": ["America/New_York"],
  "ND": ["America/Chicago", "America/Denver"],
  "OH": ["America/New_York"],
  "OK": ["America/Chicago"],
  "OR": ["America/Los_Angeles"],
  "PA": ["America/New_York"],
  "RI": ["America/New_York"],
  "SC": ["America/New_York"],
  "SD": ["America/Chicago", "America/Denver"],
  "TN": ["America/New_York", "America/Chicago"],
  "TX": ["America/Chicago", "America/Denver"],
  "UT": ["America/Denver"],
  "VT": ["America/New_York"],
  "VA": ["America/New_York"],
  "WA": ["America/Los_Angeles"],
  "WV": ["America/New_York"],
  "WI": ["America/Chicago"],
  "WY": ["America/Denver"],
  "DC": ["America/New_York"]
};

// Time zone differences in hours
export const timeZoneDifferences: Record<string, Record<string, number>> = {
  "America/New_York": {
    "America/Chicago": 1,
    "America/Denver": 2,
    "America/Los_Angeles": 3,
    "America/Phoenix": 2,
    "America/Anchorage": 4,
    "Pacific/Honolulu": 5,
    "America/Adak": 5
  },
  "America/Chicago": {
    "America/New_York": 1,
    "America/Denver": 1,
    "America/Los_Angeles": 2,
    "America/Phoenix": 1,
    "America/Anchorage": 3,
    "Pacific/Honolulu": 4,
    "America/Adak": 4
  },
  "America/Denver": {
    "America/New_York": 2,
    "America/Chicago": 1,
    "America/Los_Angeles": 1,
    "America/Phoenix": 0,
    "America/Anchorage": 2,
    "Pacific/Honolulu": 3,
    "America/Adak": 3
  },
  "America/Los_Angeles": {
    "America/New_York": 3,
    "America/Chicago": 2,
    "America/Denver": 1,
    "America/Phoenix": 1,
    "America/Anchorage": 1,
    "Pacific/Honolulu": 2,
    "America/Adak": 2
  },
  "America/Phoenix": {
    "America/New_York": 2,
    "America/Chicago": 1,
    "America/Denver": 0,
    "America/Los_Angeles": 1,
    "America/Anchorage": 2,
    "Pacific/Honolulu": 3,
    "America/Adak": 3
  }
};

// Major US cities with their coordinates (latitude, longitude)
export const cityCoordinates: Record<string, [number, number]> = {
  "new york": [40.7128, -74.0060],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "houston": [29.7604, -95.3698],
  "phoenix": [33.4484, -112.0740],
  "philadelphia": [39.9526, -75.1652],
  "san antonio": [29.4241, -98.4936],
  "san diego": [32.7157, -117.1611],
  "dallas": [32.7767, -96.7970],
  "san jose": [37.3382, -121.8863],
  "austin": [30.2672, -97.7431],
  "jacksonville": [30.3322, -81.6557],
  "fort worth": [32.7555, -97.3308],
  "columbus": [39.9612, -82.9988],
  "san francisco": [37.7749, -122.4194],
  "charlotte": [35.2271, -80.8431],
  "indianapolis": [39.7684, -86.1581],
  "seattle": [47.6062, -122.3321],
  "denver": [39.7392, -104.9903],
  "washington": [38.9072, -77.0369],
  "boston": [42.3601, -71.0589],
  "nashville": [36.1627, -86.7816],
  "baltimore": [39.2904, -76.6122],
  "portland": [45.5051, -122.6750],
  "atlanta": [33.7490, -84.3880]
};

// Acceptable commute distances (in miles) by job type
export const maxCommuteDistances: Record<string, number> = {
  "onsite": 30,
  "hybrid": 50,
  "remote": 500 // For occasional in-person meetings
};

/**
 * Parse location string into components
 * @param location Location string (e.g., "San Francisco, CA" or "New York")
 * @returns Parsed location object with city and state
 */
export function parseLocation(location: string): { city: string | null; state: string | null } {
  if (!location) {
    return { city: null, state: null };
  }
  
  const parts = location.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    return {
      city: parts[0].toLowerCase(),
      state: parts[1].toUpperCase()
    };
  }
  
  // Try to determine if the single part is a city or state
  const singlePart = parts[0];
  
  // Check if it's a state code
  if (singlePart.length === 2 && singlePart.toUpperCase() in statesToTimeZones) {
    return { city: null, state: singlePart.toUpperCase() };
  }
  
  // Assume it's a city
  return { city: singlePart.toLowerCase(), state: null };
}

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate time zone compatibility score
 * @param jobState State for the job
 * @param candidateState State for the candidate
 * @returns Time zone compatibility score (0-1)
 */
export function calculateTimeZoneCompatibility(jobState: string | null, candidateState: string | null): number {
  // If either state is missing, return neutral score
  if (!jobState || !candidateState) return 0.7;
  
  // Get possible time zones for each state
  const jobTimeZones = statesToTimeZones[jobState] || [];
  const candidateTimeZones = statesToTimeZones[candidateState] || [];
  
  if (jobTimeZones.length === 0 || candidateTimeZones.length === 0) {
    return 0.7; // Neutral score for unknown states
  }
  
  // Find minimum time zone difference
  let minDifference = 12; // Maximum possible difference
  
  for (const jobTZ of jobTimeZones) {
    for (const candidateTZ of candidateTimeZones) {
      if (jobTZ === candidateTZ) {
        return 1.0; // Same time zone, perfect match
      }
      
      // Find difference in hours
      const difference = timeZoneDifferences[jobTZ]?.[candidateTZ] ?? 
                         timeZoneDifferences[candidateTZ]?.[jobTZ] ?? 12;
      
      minDifference = Math.min(minDifference, difference);
    }
  }
  
  // Convert difference to score (0-1)
  // 0 hours = 1.0, 1 hour = 0.9, 2 hours = 0.8, 3+ hours = scaling down further
  const tzScore = Math.max(0.5, 1.0 - (minDifference * 0.1));
  return tzScore;
}

/**
 * Calculate geographic proximity between job and candidate locations
 * @param jobCity Job city
 * @param jobState Job state
 * @param candidateCity Candidate city
 * @param candidateState Candidate state
 * @returns Distance in miles, or null if can't be calculated
 */
export function calculateProximity(
  jobCity: string | null,
  jobState: string | null,
  candidateCity: string | null,
  candidateState: string | null
): number | null {
  // Check if we have enough information
  if ((!jobCity && !jobState) || (!candidateCity && !candidateState)) {
    return null;
  }
  
  // Exact city match
  if (jobCity && candidateCity && jobCity === candidateCity) {
    return 0; // Same city
  }
  
  // Try to calculate distance using coordinates
  if (jobCity && candidateCity) {
    const jobCoords = cityCoordinates[jobCity.toLowerCase()];
    const candidateCoords = cityCoordinates[candidateCity.toLowerCase()];
    
    if (jobCoords && candidateCoords) {
      return calculateDistance(
        jobCoords[0], jobCoords[1],
        candidateCoords[0], candidateCoords[1]
      );
    }
  }
  
  // Fallback: check if same state
  if (jobState && candidateState && jobState === candidateState) {
    return 50; // Approximate average intra-state distance
  }
  
  // Different states, approximate distance
  return 500; // Default for different states
}

/**
 * Calculate enhanced location match score
 * @param jobCity City for the job
 * @param jobState State for the job
 * @param jobType Job type (onsite, hybrid, remote)
 * @param candidateLocation Candidate location string
 * @returns Location match score and details
 */
export function calculateEnhancedLocationMatch(
  jobCity: string | null,
  jobState: string | null,
  jobType: string | null,
  candidateLocation: string | null
): { 
  score: number; 
  description: string;
  distance: number | null;
  isWithinCommute: boolean;
  timeZoneCompatibility: number;
} {
  // Default values
  const result = {
    score: 0,
    description: "No location data",
    distance: null,
    isWithinCommute: false,
    timeZoneCompatibility: 0.7
  };
  
  // Handle missing location data
  if (!candidateLocation) {
    return result;
  }
  
  // Parse candidate location
  const { city: candidateCity, state: candidateState } = parseLocation(candidateLocation);
  
  // For remote jobs, focus on time zone compatibility
  if (jobType === "remote") {
    const tzCompatibility = calculateTimeZoneCompatibility(jobState, candidateState);
    
    let description = "Remote position";
    if (tzCompatibility >= 0.9) {
      description += " with excellent time zone compatibility";
    } else if (tzCompatibility >= 0.7) {
      description += " with good time zone compatibility";
    } else {
      description += " with challenging time zone difference";
    }
    
    return {
      score: tzCompatibility,
      description,
      distance: null,
      isWithinCommute: true, // Remote jobs don't require commuting
      timeZoneCompatibility: tzCompatibility
    };
  }
  
  // Calculate proximity
  const distance = calculateProximity(jobCity, jobState, candidateCity, candidateState);
  const timeZoneCompatibility = calculateTimeZoneCompatibility(jobState, candidateState);
  
  // Determine if within acceptable commute distance
  const maxDistance = maxCommuteDistances[jobType || "onsite"];
  const isWithinCommute = distance !== null && distance <= maxDistance;
  
  // Exact city match (best for onsite)
  if (jobCity && candidateCity && jobCity.toLowerCase() === candidateCity.toLowerCase()) {
    return {
      score: 1.0,
      description: `Same city (${jobCity})`,
      distance: 0,
      isWithinCommute: true,
      timeZoneCompatibility: 1.0
    };
  }
  
  // Same state match
  if (jobState && candidateState && jobState === candidateState) {
    // Different score based on job type
    const score = jobType === "hybrid" ? 0.9 : 
                  jobType === "onsite" ? 0.7 : 0.95;
    
    return {
      score,
      description: `Same state (${jobState})${candidateCity ? ` - ${candidateCity}` : ''}`,
      distance: distance || 50, // Approximate if we don't have exact distance
      isWithinCommute: isWithinCommute,
      timeZoneCompatibility: 1.0
    };
  }
  
  // Different state but nearby
  if (distance !== null && isWithinCommute) {
    // Score based on distance and job type
    const distanceScore = 1 - (distance / maxDistance);
    
    // Weight differently based on job type
    const score = jobType === "onsite" ? distanceScore * 0.8 : 
                  jobType === "hybrid" ? distanceScore * 0.9 : 
                  distanceScore * 0.95;
    
    return {
      score: Math.min(0.95, score), // Cap at 0.95 for different states
      description: `Within commutable distance (${Math.round(distance)} miles)`,
      distance,
      isWithinCommute: true,
      timeZoneCompatibility: timeZoneCompatibility
    };
  }
  
  // Different state, not within commutable distance
  if (jobType === "onsite") {
    return {
      score: 0.1,
      description: "Location too far for onsite role",
      distance: distance,
      isWithinCommute: false,
      timeZoneCompatibility: timeZoneCompatibility
    };
  }
  
  if (jobType === "hybrid") {
    // For hybrid, give a modest score based on time zone compatibility
    const score = 0.2 + (timeZoneCompatibility * 0.3);
    return {
      score,
      description: "Location distant for hybrid role, but may work occasionally",
      distance: distance,
      isWithinCommute: false,
      timeZoneCompatibility: timeZoneCompatibility
    };
  }
  
  // Default case
  return {
    score: 0.3,
    description: "Partial location match",
    distance: distance,
    isWithinCommute: false,
    timeZoneCompatibility: timeZoneCompatibility
  };
}