// State abbreviation to full name mapping
const STATE_ABBREVIATIONS: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

export interface ParsedJobData {
  title?: string;
  client?: string;
  city?: string;
  state?: string;
  rate?: string;
  interviewType?: string;
  visaRestrictions?: string;
  requiredSkills?: string[];
  description?: string;
}

export async function parseJobRequirements(requirementText: string): Promise<ParsedJobData> {
  try {
    const text = requirementText.toLowerCase();
    const lines = requirementText.split('\n').filter(line => line.trim());
    
    const result: ParsedJobData = {};
    
    // Extract job title (common patterns: "position:", "title:", "role:")
    const titleMatch = text.match(/(?:position|title|role|job)\s*:?\s*(.+)/i);
    if (titleMatch) {
      result.title = titleMatch[1].trim();
    }
    
    // Extract client/company (common patterns: "client:", "company:")
    const clientMatch = text.match(/(?:client|company|employer)\s*:?\s*(.+)/i);
    if (clientMatch) {
      result.client = clientMatch[1].trim();
    }
    
    // Extract location (patterns: "location:", "city, state", state abbreviations)
    let locationMatch = text.match(/(?:location|city|address)\s*:?\s*([^,\n]+)(?:,\s*([a-z]{2}|\w+\s+\w+))?/i);
    
    // If no labeled location found, try to find city, state patterns anywhere in text
    if (!locationMatch) {
      locationMatch = text.match(/([a-z\s]+),?\s+([a-z]{2})\b/i);
    }
    
    if (locationMatch) {
      result.city = locationMatch[1].trim();
      if (locationMatch[2]) {
        let stateValue = locationMatch[2].trim();
        // Convert state abbreviation to full name if found
        const stateAbbr = stateValue.toUpperCase();
        if (STATE_ABBREVIATIONS[stateAbbr]) {
          result.state = STATE_ABBREVIATIONS[stateAbbr];
        } else {
          result.state = stateValue;
        }
      }
    }
    
    // Extract rate (patterns: "$xx/hr", "$xx-xx/hr", "$xxxk", etc.)
    const rateMatch = text.match(/(?:rate|salary|pay|compensation)\s*:?\s*(\$[\d,.-]+(?:\/(?:hr|hour|year|annually))?(?:\s*-\s*\$[\d,.-]+(?:\/(?:hr|hour|year|annually))?)?(?:k|000)?)/i);
    if (rateMatch) {
      result.rate = rateMatch[1].trim();
    }
    
    // Extract interview type
    const interviewMatch = text.match(/(?:interview|meeting)\s*:?\s*(phone|video|onsite|hybrid|in-person|remote)/i);
    if (interviewMatch) {
      result.interviewType = interviewMatch[1].trim();
    }
    
    // Extract visa restrictions
    const visaMatch = text.match(/(?:visa|authorization|citizenship|eligibility)\s*:?\s*([^.\n]+)/i);
    if (visaMatch) {
      result.visaRestrictions = visaMatch[1].trim();
    }
    
    // Extract skills (look for common skill-related keywords and lists)
    const skillsText = text.match(/(?:skills|technologies|requirements|experience|tech stack)\s*:?\s*([^.]+(?:\n[^:\n]*)*)/i);
    if (skillsText) {
      const skillsString = skillsText[1];
      // Split by common delimiters and clean up
      const skills = skillsString
        .split(/[,;|\n]/)
        .map(skill => skill.trim())
        .filter(skill => skill && skill.length > 1 && skill.length < 50)
        .slice(0, 20); // Limit to reasonable number
      
      if (skills.length > 0) {
        result.requiredSkills = skills;
      }
    }
    
    // Use the full text as description, cleaned up
    result.description = requirementText
      .split('\n')
      .filter(line => line.trim())
      .join('\n')
      .trim();
    
    return result;
  } catch (error) {
    console.error('Error parsing job requirements:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to parse job requirements: ${errorMessage}`);
  }
}