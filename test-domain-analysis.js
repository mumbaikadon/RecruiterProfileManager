/**
 * Test script for domain expertise analysis without PDF parsing
 * This uses pre-extracted resume text for analysis
 */

import { OpenAI } from 'openai';

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Analyze a resume with OpenAI for domain-specific expertise
 * @param {string} resumeText - The extracted resume text
 * @param {string} jobDescription - The job description
 */
async function analyzeDomainExpertise(resumeText, jobDescription) {
  try {
    console.log("Starting OpenAI analysis...");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer specializing in business analysis roles. " +
            "Your strength is identifying specific, nuanced gaps between a candidate's business analysis experience and job requirements. " +
            "You are precise in identifying domain-specific missing expertise rather than generic skill gaps. " +
            "For business analyst roles, identify domain-specific gaps like 'Insufficient experience with specific process modeling notations such as BPMN' rather than general skills like 'system diagramming'."
        },
        {
          role: "user",
          content: 
            `I need you to analyze this resume for compatibility with the following business analyst job description, with special focus on business analysis domain expertise gaps.
            
            Resume:
            ${resumeText}
            
            Job Description:
            ${jobDescription}
            
            IMPORTANT - ANALYSIS INSTRUCTIONS:
            1. Identify detailed, domain-specific business analysis expertise gaps between the resume and job requirements
            2. For each significant gap, provide specific details about:
               a) The precise nature of the business analysis expertise gap
               b) The level of importance (critical, important, nice-to-have)
               c) Why this specific business analysis expertise matters for this role
               d) Specific suggestions to address the gap
            3. Calculate an overall domain knowledge score (0-100) for business analysis expertise
            
            Return your analysis in a structured JSON format with the following fields:
            - domainExpertiseGaps (array of business analysis specific expertise gaps)
            - domainKnowledgeScore (number 0-100 indicating business analysis domain knowledge level)
            - gapDetails: [
                {
                  category: string (e.g., "Business Process Modeling", "Requirements Elicitation")
                  gaps: string[] (Business analysis specific gaps in this category)
                  importance: string (Critical, Important, or Nice-to-have)
                  impact: string (How this domain expertise gap impacts the role)
                  suggestions: string[] (Ways to address this domain-specific gap)
                }
              ]
            - strengths: string[] (Key business analysis strengths for this role)
            - overallScore: number (0-100)`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2000,
    });
    
    console.log("OpenAI analysis completed");
    
    // Parse the response content
    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    // Display the domain expertise analysis in a formatted way
    displayDomainExpertiseAnalysis(analysisResult);
    
    return analysisResult;
  } catch (error) {
    console.error("Error during OpenAI analysis:", error);
    throw error;
  }
}

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

/**
 * Main function to run the test
 */
async function main() {
  try {
    console.log("Starting Business Analyst domain expertise analysis test...");
    
    // Pre-extracted resume text from Drew Corrigan's CV
    const resumeText = `
    Drew Corrigan
    Monroe, WA              (206) 856-6499    Corrigan.drc@gmail.com
    
    Summary
    Detail-oriented Business Systems Analyst with 11 years of experience delivering solutions across ERP, CRM, and
    payment processing platforms. Strong background in application support, system optimization, and integration,
    ensuring seamless functionality and user experience. Skilled in optimizing system configurations, integrations, and
    reporting solutions. Proven ability to support cross-functional initiatives involving financial analysis, operations, and
    customer experience, with a strong focus on data consistency, system usability, and process automation. Adept at
    managing stakeholder priorities, resolving complex issues, and guiding product strategy through cost, data, and
    performance-driven insights. Thrive in both independent and collaborative team environments.
    
    Work Experience
    2022 - 2025 Functional Business Analyst III - Costco IT, Issaquah WA
    • Functional analyst for Costco's eComm digital services management team, monitoring API service availability daily
    to ensure compliance with SLAs (Splunk/Excel); providing assistance to high priority incidents related to service
    vendors (SaaS) specific to payment and fraud, including Accertify, Mastercard/Ekata, Fiserv, and LexisNexis
    • Collaborated with internal and external teams; Vendor Management, Legal, Privacy, Engineers, Analysts, Business
    and IT leadership to establish alignments on priorities, development tasks, testing, and deployment activity
    • Managed service contract agreements (MSA), renewals (SoW), purchase orders, cost plans, and invoice
    reconciliation (Ariba/SAP), ensuring the actual costs align with the approved budgeted fiscal forecasts, keeping
    variances under 5% of their forecasts for 8 different vendors totalling 4.5M annually, accounting for YOY growth
    • Led the assessment of IT requirements for 5 high-impact projects, engaging 8 stakeholders to ensure
    comprehensive scope definition; this initiative improved project timelines by an average of 2 weeks per project
    • Analyzed IS requirements across B2C and OMS teams, identifying shared objectives and dependency mapping,
    improving delivery timelines and cross-team PI alignment through streamlined communication (SAFe)
    • Identified opportunities to reduce transaction fraud and risk scenarios to enhance overall risk management
    services (RMS) leading to an annual savings of $550k, fostering strong relationships with service partners
    • Coordinated the onboarding of new digital service partners, requesting Privacy Impact Assessment (PIA/VRA) to
    identify and mitigate privacy risks related to data and PII in collaboration with the risk management team
    • Utilized ServiceNow (INC/CHG/PRB) for incident, change, and problem management based on trend reporting.
    • Adapted Jira methodologies, Agile Scrum/Kanban (Azure DevOps), writing user sprint stories focusing on high
    priority projects which bring value and a positive impact to both end users and business stakeholders
    • Led the identification, analysis, documentation and implementation for project compliance, including key policy
    and procedure improvements, SOPs, tools and methods for Costco's digital product management teams
    • Acted as the service account advocate promoting the inclusion of software enhancement and fixes for future
    development work, while noting all planned outages on a shared maintenance calendar
    
    2020 - 2022 Systems Analyst II - Starbucks, Seattle WA
    • Worked on the Starbucks Connect program to assist store partners and vendors in provisioning new POS
    hardware (Oracle Simphony), and POS installation using remote access and software distribution tools
    • Integrated Elavon's Converge API to support full payment lifecycle: tokenization, authorization, capture, refund, and
    reconciliation. Conducted root-cause analysis on failed transactions based on error codes and card response data
    • Led investigation and resolution of Elavon PED processing issues, partnering with store teams to execute end-to-end
    test transactions; validated tipping configuration and ensured seamless integration for POS system payment along
    with mobile orders for card-present and card-not-present scenarios
    • Analyzed system configuration for Starbucks Connect stores, scheduling procedures to address bug fixes and
    producing server endpoint credentials for Starbucks stores being staged (RDP/Kaseya)
    • Collaborated with internal business and IT teams (CSM/TAM) to assist with bi-monthly projects along with active
    problems, strategizing long-term resolutions for ongoing issues reported to Starbucks service desk (NCR)
    • Reviewed benefits developed from system improvements, assessed possible bottlenecks and major impacts on
    the business stakeholders. Producing prompt and thorough communication with individual end-users (Salesforce)
    • Assisted with testing and implementing system updates to help with the integration between cross-functional
    team applications, while keeping Confluence KBA's & SOP's up to date with procedural findings (Atlassian)
    • Created a variety of reports with detailed filters to provide advanced dashboards and metrics on performance
    • Worked with internal IT and business partners to aid with standardizing successful deployment plans for
    Starbucks Connect store system upgrades, ensuring optimal performance and reliability (Microsoft Office 365)
    • Ran queries (Splunk) for approximate data analysis on issues reported to the service desk
    
    2014 - 2020 Systems Analyst - Holland America Line, Seattle WA
    • Primary support for all shipboard applications including Oracle's ERP hotel property management system, analyzing
    system capabilities, and gathering requirements to improve business processes for fleet systems
    • Managed and prioritized active production support incidents (ServiceNow) based on urgency and complexity
    • Expert in agile scrum project management, hosting sprint meetings with business users, Jira backlog grooming
    (Atlassian), and retrospective meetings to highlight accomplishments along with areas for process improvements
    • Maintained scheduled automated jobs for IT, HR, OBR, GEPD, logistics and nautical teams helping optimize process
    workflows and improve overall performance by 60% with successful (.dta) file transfers, while ensuring ship POS
    menu items were configured correctly and reflecting active available items (Oracle Simphony 9500)
    • Collaborated with cross-functional teams to assess customer needs, working with product owners, business users,
    and DevOps to implement high value features, increasing guest satisfaction and revenue (Microsoft Dynamics 365)
    • Strong communication skills, collaborating with business users on consumer enhancement requests integrated
    with existing systems, uploading enhancements in UAT, and confirm end user approval in QA before deployment
    • Produced 25+ data reports using ServiceNow, Crystal, Excel (data validation/pivot tables) to create dynamic
    presentations showing application trends and analysis to identify system bottlenecks (ITSM)
    • Project Manager for 6 business and IT initiatives, outlining project scope, and ensuring both technical and business
    impacts have been assessed for architecture review, increasing project consistency by an average of 20%
    • Assisted risk advisory and governance team with SOX audits, identifying potential risks with compliance impacts
    • Supported system data and functions including itinerary, procurement, inventory, supply chain, finance, and
    eCommerce. Ensuring successful ship to shore data transfers to address any new passenger request changes
    • Assisted with running manual SQL scripts via Scriptrunner (Toad), deploying report files fleet-wide (FTP), and
    facilitating manual workarounds during known maintenance outage windows
    • Created and maintained system documentation SOP and Wiki KBA's within Confluence (Atlassian)
    
    Education
    Central Washington University - Ellensburg WA
    Bachelor of Science - Information Technology and Administrative Management
    `;
    
    // Business Analyst job description
    const bsaJobDescription = `
    Business Systems Analyst Position
    
    We are seeking an experienced Business Systems Analyst to help optimize our business processes and systems. The ideal candidate will have strong skills in business process modeling, requirements elicitation, and system diagramming. Experience with UML, BPMN, and gap analysis is required.
    
    Key Responsibilities:
    - Document complex business processes using BPMN and UML notations
    - Support architects in designing system solutions that meet business needs
    - Perform gap analysis between current and future state processes
    - Elicit and document detailed business requirements from stakeholders
    - Create user stories and acceptance criteria for development teams
    - Validate that implemented solutions meet business requirements
    
    Requirements:
    - 5+ years of experience as a Business Analyst or Systems Analyst
    - Strong knowledge of business process modeling techniques (BPMN, UML)
    - Experience supporting system architects in solution design
    - Expertise in requirements elicitation and documentation
    - Familiarity with agile methodologies and user story creation
    - Strong communication and stakeholder management skills
    `;
    
    console.log(`Resume text length: ${resumeText.length} characters`);
    
    // Analyze for business analyst domain expertise
    await analyzeDomainExpertise(resumeText, bsaJobDescription);
    
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Run the main function
main();