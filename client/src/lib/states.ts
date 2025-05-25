/**
 * Utility functions for handling US state names and abbreviations
 */

// Map of US state abbreviations to full names
export const stateMap: Record<string, string> = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'DC': 'District of Columbia',
  'AS': 'American Samoa',
  'GU': 'Guam',
  'MP': 'Northern Mariana Islands',
  'PR': 'Puerto Rico',
  'VI': 'U.S. Virgin Islands'
};

/**
 * Returns the full state name from a state abbreviation
 * @param stateAbbr - The two-letter state abbreviation
 * @returns The full state name or the original input if not found
 */
export function getStateName(stateAbbr: string): string {
  if (!stateAbbr) return '';
  
  // Convert to uppercase for consistency
  const upperAbbr = stateAbbr.toUpperCase();
  
  // Return the full state name if found, otherwise return the original input
  return stateMap[upperAbbr] || stateAbbr;
}

/**
 * Get the state abbreviation from a full state name
 * @param stateName - The full state name
 * @returns The two-letter state abbreviation or the original input if not found
 */
export function getStateAbbreviation(stateName: string): string {
  if (!stateName) return '';
  
  // Look through the map for a matching state name
  for (const [abbr, name] of Object.entries(stateMap)) {
    if (name.toLowerCase() === stateName.toLowerCase()) {
      return abbr;
    }
  }
  
  // Return the original input if no match found
  return stateName;
}

/**
 * Gets the list of all US states as an array of objects with value and label properties
 * @returns Array of state objects with value (abbreviation) and label (full name)
 */
export function getStateOptions(): Array<{ value: string; label: string }> {
  return Object.entries(stateMap).map(([abbr, name]) => ({
    value: abbr,
    label: name
  }));
}