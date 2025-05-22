/**
 * Client Experience Matching Module
 * 
 * This module provides enhanced client experience matching for job recommendations,
 * with industry recognition and domain expertise evaluation.
 */

// Industry groupings of companies
export const companyIndustries: Record<string, string[]> = {
  "Technology": [
    "Google", "Microsoft", "Apple", "Amazon", "Facebook", "Meta", "IBM", "Oracle", 
    "Intel", "Cisco", "Dell", "HP", "Salesforce", "Adobe", "SAP", "VMware", "Twilio",
    "Twitter", "LinkedIn", "Slack", "Zoom", "Dropbox", "Snowflake", "ServiceNow"
  ],
  "Finance": [
    "JPMorgan Chase", "Bank of America", "Wells Fargo", "Citigroup", "Goldman Sachs",
    "Morgan Stanley", "Capital One", "American Express", "Visa", "Mastercard",
    "BlackRock", "Fidelity", "Charles Schwab", "Vanguard", "HSBC", "Barclays",
    "Deutsche Bank", "UBS", "Credit Suisse", "BNY Mellon", "State Street"
  ],
  "Healthcare": [
    "Johnson & Johnson", "Pfizer", "UnitedHealth", "CVS Health", "Anthem", "Cigna",
    "Humana", "HCA Healthcare", "Mayo Clinic", "Cleveland Clinic", "Kaiser Permanente",
    "Medtronic", "Abbott Laboratories", "Merck", "Eli Lilly", "Bristol-Myers Squibb",
    "Gilead Sciences", "Amgen", "Biogen", "Moderna", "Novartis", "AstraZeneca"
  ],
  "Retail": [
    "Walmart", "Target", "Costco", "Home Depot", "Lowe's", "Best Buy", "Kroger",
    "Walgreens", "CVS", "Macy's", "Nordstrom", "Gap", "Nike", "Adidas", "Starbucks",
    "McDonald's", "Coca-Cola", "PepsiCo", "Procter & Gamble", "Unilever", "Nestlé"
  ],
  "Manufacturing": [
    "General Electric", "Boeing", "Lockheed Martin", "Caterpillar", "3M", "Honeywell",
    "General Motors", "Ford", "Chrysler", "Toyota", "Honda", "Tesla", "Siemens", 
    "Philips", "Panasonic", "LG", "Samsung", "Sony", "John Deere", "Dow Chemical"
  ],
  "Energy": [
    "ExxonMobil", "Chevron", "BP", "Shell", "ConocoPhillips", "Valero Energy",
    "Duke Energy", "NextEra Energy", "Southern Company", "Dominion Energy", 
    "Sempra Energy", "Phillips 66", "Marathon Petroleum", "Halliburton"
  ],
  "Media": [
    "Disney", "Comcast", "AT&T", "Verizon", "Netflix", "Warner Bros", "Universal",
    "Paramount", "Sony Pictures", "Fox Corporation", "ViacomCBS", "Discovery",
    "Spotify", "New York Times", "Thomson Reuters", "Bloomberg", "iHeartMedia"
  ],
  "Consulting": [
    "McKinsey", "Boston Consulting Group", "Bain & Company", "Deloitte", "PwC",
    "EY", "KPMG", "Accenture", "Booz Allen Hamilton", "Capgemini", "Cognizant",
    "Infosys", "Tata Consultancy Services", "Wipro", "HCL Technologies", "IBM Global Services"
  ],
  "Insurance": [
    "State Farm", "Berkshire Hathaway", "Progressive", "Allstate", "Liberty Mutual",
    "USAA", "Travelers", "Nationwide", "AIG", "MetLife", "Prudential", "New York Life",
    "Northwestern Mutual", "Aflac", "Lincoln Financial", "Principal Financial Group"
  ]
};

// Domain expertise areas by industry
export const industryDomains: Record<string, string[]> = {
  "Technology": [
    "Cloud Computing", "Artificial Intelligence", "Machine Learning", "Cybersecurity",
    "Big Data", "Internet of Things", "Blockchain", "Enterprise Software", "E-commerce",
    "FinTech", "HealthTech", "EdTech", "Gaming", "Social Media", "Mobile Apps"
  ],
  "Finance": [
    "Investment Banking", "Asset Management", "Wealth Management", "Retail Banking",
    "Insurance", "Payment Processing", "Financial Regulation", "Risk Management",
    "Compliance", "Lending", "Mortgages", "Financial Analytics", "Algorithmic Trading"
  ],
  "Healthcare": [
    "Pharmaceuticals", "Biotechnology", "Health Insurance", "Electronic Health Records",
    "Medical Devices", "Telemedicine", "Clinical Research", "Healthcare IT",
    "Patient Care", "Hospital Administration", "Public Health", "Regulatory Compliance"
  ],
  "Retail": [
    "E-commerce", "Omnichannel Retail", "Supply Chain Management", "Inventory Management",
    "Point of Sale Systems", "Customer Loyalty Programs", "Retail Analytics",
    "Merchandising", "Consumer Packaged Goods", "Retail Marketing"
  ],
  "Manufacturing": [
    "Supply Chain Management", "Quality Control", "Lean Manufacturing", "Automation",
    "Robotics", "Industrial IoT", "Materials Science", "Product Design",
    "Logistics", "Inventory Management", "ERP Systems", "Procurement"
  ]
};

// Regulated industries that value compliance experience
export const regulatedIndustries = [
  "Finance",
  "Healthcare",
  "Pharmaceuticals",
  "Energy",
  "Telecommunications",
  "Insurance"
];

/**
 * Normalize company name for better matching
 * @param name Company name to normalize
 * @returns Normalized company name
 */
function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  // Remove common legal suffixes
  const normalized = name.replace(/\b(Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|Limited|Group|Holdings|Company)\b/gi, '')
    // Remove punctuation
    .replace(/[^\w\s]/gi, '')
    // Convert to lowercase and trim
    .toLowerCase().trim();
  
  return normalized;
}

/**
 * Get industry for a company
 * @param companyName Company name to look up
 * @returns Industry name or null if not found
 */
export function getCompanyIndustry(companyName: string): string | null {
  if (!companyName) return null;
  
  const normalizedName = normalizeCompanyName(companyName);
  
  for (const [industry, companies] of Object.entries(companyIndustries)) {
    // Try to find exact match
    const hasExactMatch = companies.some(company => 
      normalizeCompanyName(company) === normalizedName
    );
    
    if (hasExactMatch) {
      return industry;
    }
    
    // Try to find partial match
    const hasPartialMatch = companies.some(company => {
      const normalizedCompany = normalizeCompanyName(company);
      return normalizedCompany.includes(normalizedName) || 
             normalizedName.includes(normalizedCompany);
    });
    
    if (hasPartialMatch) {
      return industry;
    }
  }
  
  return null;
}

/**
 * Get domains associated with an industry
 * @param industry Industry name
 * @returns Array of domain areas
 */
export function getIndustryDomains(industry: string): string[] {
  if (!industry) return [];
  return industryDomains[industry] || [];
}

/**
 * Check if an industry is regulated
 * @param industry Industry name
 * @returns True if regulated
 */
export function isRegulatedIndustry(industry: string): boolean {
  return regulatedIndustries.includes(industry);
}

/**
 * Calculate client experience match between job and candidate
 * @param jobClientName Client name from job
 * @param candidateClientNames Array of client names from candidate's experience
 * @returns Client experience match details
 */
export function calculateClientExperienceMatch(
  jobClientName: string | null,
  candidateClientNames: string[] | null
): { 
  hasExperience: boolean; 
  clientName: string | null;
  industryMatch: boolean;
  industryName: string | null;
  isRegulated: boolean;
  domainExperience: string[];
  score: number;
} {
  // Default result
  const defaultResult = {
    hasExperience: false,
    clientName: null,
    industryMatch: false,
    industryName: null,
    isRegulated: false,
    domainExperience: [],
    score: 0
  };
  
  // Handle missing data
  if (!jobClientName || !candidateClientNames || candidateClientNames.length === 0) {
    // Fall back to the old approach (looking for client names in job title)
    return defaultResult;
  }
  
  const normalizedJobClient = normalizeCompanyName(jobClientName);
  
  // Check for direct client match (highest priority)
  for (const candidateClient of candidateClientNames) {
    const normalizedCandidateClient = normalizeCompanyName(candidateClient);
    
    // Direct match
    if (normalizedJobClient === normalizedCandidateClient) {
      return {
        hasExperience: true,
        clientName: candidateClient,
        industryMatch: true,
        industryName: getCompanyIndustry(candidateClient),
        isRegulated: isRegulatedIndustry(getCompanyIndustry(candidateClient) || ''),
        domainExperience: getIndustryDomains(getCompanyIndustry(candidateClient) || ''),
        score: 1.0 // Perfect match
      };
    }
    
    // Partial match (one contains the other)
    if (normalizedJobClient.includes(normalizedCandidateClient) || 
        normalizedCandidateClient.includes(normalizedJobClient)) {
      return {
        hasExperience: true,
        clientName: candidateClient,
        industryMatch: true,
        industryName: getCompanyIndustry(candidateClient),
        isRegulated: isRegulatedIndustry(getCompanyIndustry(candidateClient) || ''),
        domainExperience: getIndustryDomains(getCompanyIndustry(candidateClient) || ''),
        score: 0.9 // Strong match
      };
    }
  }
  
  // No direct client match, check for industry match
  const jobClientIndustry = getCompanyIndustry(jobClientName);
  
  if (jobClientIndustry) {
    // Check if candidate has experience in the same industry
    const candidateIndustries = new Set<string>();
    
    for (const candidateClient of candidateClientNames) {
      const industry = getCompanyIndustry(candidateClient);
      if (industry) {
        candidateIndustries.add(industry);
      }
    }
    
    if (candidateIndustries.has(jobClientIndustry)) {
      // Find the matching client
      const matchingClient = candidateClientNames.find(client => 
        getCompanyIndustry(client) === jobClientIndustry
      );
      
      return {
        hasExperience: true,
        clientName: matchingClient,
        industryMatch: true,
        industryName: jobClientIndustry,
        isRegulated: isRegulatedIndustry(jobClientIndustry),
        domainExperience: getIndustryDomains(jobClientIndustry),
        score: 0.7 // Good industry match
      };
    }
    
    // Check for regulated industry experience
    if (isRegulatedIndustry(jobClientIndustry)) {
      // Check if candidate has experience in any regulated industry
      const hasRegulatedExperience = Array.from(candidateIndustries).some(industry => 
        isRegulatedIndustry(industry)
      );
      
      if (hasRegulatedExperience) {
        // Find the matching regulated client
        const matchingClient = candidateClientNames.find(client => {
          const industry = getCompanyIndustry(client);
          return industry ? isRegulatedIndustry(industry) : false;
        });
        
        return {
          hasExperience: true,
          clientName: matchingClient,
          industryMatch: false,
          industryName: getCompanyIndustry(matchingClient || ''),
          isRegulated: true,
          domainExperience: [],
          score: 0.5 // Moderate match for regulated industry experience
        };
      }
    }
  }
  
  // No match
  return defaultResult;
}