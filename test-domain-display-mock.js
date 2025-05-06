/**
 * Test script to display mock domain expertise analysis
 * This doesn't call OpenAI, just shows how the UI would display the results
 */

// Mock analysis result for business analyst domain expertise
const mockAnalysisResult = {
  "domainExpertiseGaps": [
    "Limited experience with formal business process modeling using BPMN notation",
    "Insufficient evidence of UML diagramming for system design documentation",
    "Gap in specific experience with architect support for solution design",
    "Limited formal training in business process modeling techniques",
    "No demonstrated experience with formal gap analysis methodologies"
  ],
  "domainKnowledgeScore": 68,
  "gapDetails": [
    {
      "category": "Business Process Modeling",
      "gaps": [
        "Limited experience with formal BPMN notation for process documentation",
        "No explicit experience with process mapping tools like Visio, Lucidchart specifically for business process modeling"
      ],
      "importance": "Critical",
      "impact": "Will struggle to document complex business processes in the standardized notation required by the role, potentially causing miscommunication between business and technical teams",
      "suggestions": [
        "Complete a BPMN certification or training course",
        "Practice creating process models for previous work experiences using proper BPMN notation",
        "Add examples of BPMN models to portfolio if available"
      ]
    },
    {
      "category": "System Architecture Documentation",
      "gaps": [
        "Limited evidence of UML diagramming skills",
        "No specific experience supporting system architects as mentioned in job requirements"
      ],
      "importance": "Important",
      "impact": "May face challenges when collaborating with architects on system design solutions and translating business requirements into technical specifications",
      "suggestions": [
        "Take a UML modeling course focused on business analysis applications",
        "Gain experience with tools like Enterprise Architect or similar UML modeling tools",
        "Highlight any experience working alongside architects or technical teams"
      ]
    },
    {
      "category": "Formal Gap Analysis",
      "gaps": [
        "No demonstrated experience with structured gap analysis methodologies",
        "Limited evidence of comparing current state vs. future state processes"
      ],
      "importance": "Important",
      "impact": "May struggle with a key job responsibility of performing structured gap analysis between current and future state processes",
      "suggestions": [
        "Study formal gap analysis frameworks and methodologies",
        "Apply gap analysis techniques to previous work experiences retrospectively",
        "Create sample gap analysis documentation for portfolio"
      ]
    }
  ],
  "strengths": [
    "Extensive experience (11 years) as a Business Systems Analyst across multiple industries",
    "Strong stakeholder management and collaboration skills with cross-functional teams",
    "Experience with Agile methodologies including Scrum, Kanban, and writing user stories",
    "Proven ability in requirements gathering and analysis across multiple organizations",
    "Track record of process improvement and optimization at Costco, Starbucks, and Holland America",
    "Experience with service management tools like ServiceNow for incident, change, and problem management"
  ],
  "overallScore": 85
};

/**
 * Display domain expertise analysis in a formatted way
 * @param {object} result - The analysis result
 */
function displayDomainExpertiseAnalysis(result) {
  console.log("\n======== BUSINESS ANALYST DOMAIN EXPERTISE ANALYSIS ========\n");
  
  // Domain knowledge score
  console.log(`Domain Knowledge Score: ${result.domainKnowledgeScore}/100`);
  console.log("├" + "─".repeat(Math.floor(result.domainKnowledgeScore / 2)) + "┤");
  console.log("0                  50                  100");
  
  // Score interpretation
  let scoreInterpretation = "";
  if (result.domainKnowledgeScore >= 70) {
    scoreInterpretation = "Strong business analysis knowledge - Candidate has solid expertise";
  } else if (result.domainKnowledgeScore >= 40) {
    scoreInterpretation = "Moderate business analysis knowledge - Some domain-specific gaps exist";
  } else {
    scoreInterpretation = "Limited business analysis knowledge - Significant expertise gaps";
  }
  console.log(`Interpretation: ${scoreInterpretation}\n`);
  
  // Domain expertise gaps
  console.log("BUSINESS ANALYSIS EXPERTISE GAPS:");
  console.log("-------------------------------");
  result.domainExpertiseGaps.forEach((gap, i) => {
    console.log(`${i+1}. ${gap}`);
  });
  
  // Detailed gap analysis
  console.log("\nDETAILED GAP ANALYSIS BY CATEGORY:");
  console.log("----------------------------------");
  result.gapDetails.forEach((category, i) => {
    console.log(`\n[${category.importance}] ${category.category}`);
    console.log(`Impact: ${category.impact}`);
    
    console.log("\nSpecific Gaps:");
    category.gaps.forEach((gap, j) => {
      console.log(`  • ${gap}`);
    });
    
    console.log("\nSuggestions:");
    category.suggestions.forEach((suggestion, j) => {
      console.log(`  ✓ ${suggestion}`);
    });
    
    if (i < result.gapDetails.length - 1) {
      console.log("\n" + "-".repeat(50));
    }
  });
  
  // Key strengths
  console.log("\nKEY BUSINESS ANALYSIS STRENGTHS:");
  console.log("-------------------------------");
  result.strengths.forEach((strength, i) => {
    console.log(`${i+1}. ${strength}`);
  });
}

// Display the mock analysis
displayDomainExpertiseAnalysis(mockAnalysisResult);

console.log("\n\nThis is a mock display of how domain-specific expertise gaps would appear in the UI.");
console.log("Note how the gaps are specifically related to business analysis expertise rather than general skills.");
console.log("The implementation uses OpenAI to analyze real resumes against job descriptions.");