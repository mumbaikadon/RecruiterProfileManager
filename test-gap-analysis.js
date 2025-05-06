/**
 * Test script for running the enhanced gap analysis functionality
 * This will compare Drew's resume against the Business Systems Analyst job requirements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchResumeToJob } from './server/openai.js';

// Job description from the user's input
const jobDescription = `
Business Systems Analyst -- on the systems side, more than functional
for the payments team

-POS

-articulate the various API calls and what they were used for as it relates to payment processing

-card present vs. card not present use cases

-payment processing lifecycle

payment channel experience
want to be complementary to SA
Take over a lot of those complimentary things
to make sure technical teams have gotten the work and are executing on them
understanding how payments works

gap analysis
system diagramming
supporting the architects
team that's looked to help understand and drive all things to help payments
have to speak technical and business
write user stories

Qualifications: 
·5+ years of business analyst experience within eCommerce industry 
`;

// Extract the resume text
const extractResumeText = () => {
  const resumeText = `
  Drew Corrigan
  Monroe, WA (206) 856-6499 Corrigan.drc@gmail.com

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
  ● Functional analyst for Costco's eComm digital services management team, monitoring API service availability daily
     to ensure compliance with SLAs (Splunk/Excel); providing assistance to high priority incidents related to service
     vendors (SaaS) specific to payment and fraud, including Accertify, Mastercard/Ekata, Fiserv, and LexisNexis
  ● Collaborated with internal and external teams; Vendor Management, Legal, Privacy, Engineers, Analysts, Business
     and IT leadership to establish alignments on priorities, development tasks, testing, and deployment activity
  ● Managed service contract agreements (MSA), renewals (SoW), purchase orders, cost plans, and invoice
     reconciliation (Ariba/SAP), ensuring the actual costs align with the approved budgeted fiscal forecasts, keeping
     variances under 5% of their forecasts for 8 different vendors totalling 4.5M annually, accounting for YOY growth
  ● Led the assessment of IT requirements for 5 high-impact projects, engaging 8 stakeholders to ensure
     comprehensive scope definition; this initiative improved project timelines by an average of 2 weeks per project
  ● Analyzed IS requirements across B2C and OMS teams, identifying shared objectives and dependency mapping,
     improving delivery timelines and cross-team PI alignment through streamlined communication (SAFe)
  ● Identified opportunities to reduce transaction fraud and risk scenarios to enhance overall risk management
     services (RMS) leading to an annual savings of $550k, fostering strong relationships with service partners
  ● Coordinated the onboarding of new digital service partners, requesting Privacy Impact Assessment (PIA/VRA) to
     identify and mitigate privacy risks related to data and PII in collaboration with the risk management team
  ● Utilized ServiceNow (INC/CHG/PRB) for incident, change, and problem management based on trend reporting.
  ● Adapted Jira methodologies, Agile Scrum/Kanban (Azure DevOps), writing user sprint stories focusing on high
     priority projects which bring value and a positive impact to both end users and business stakeholders
  ● Led the identification, analysis, documentation and implementation for project compliance, including key policy
     and procedure improvements, SOPs, tools and methods for Costco's digital product management teams
  ● Acted as the service account advocate promoting the inclusion of software enhancement and fixes for future
     development work, while noting all planned outages on a shared maintenance calendar

  2020 - 2022 Systems Analyst II - Starbucks, Seattle WA
  ● Worked on the Starbucks Connect program to assist store partners and vendors in provisioning new POS
     hardware (Oracle Simphony), and POS installation using remote access and software distribution tools
  ● Integrated Elavon's Converge API to support full payment lifecycle: tokenization, authorization, capture, refund, and
     reconciliation. Conducted root-cause analysis on failed transactions based on error codes and card response data
  ● Led investigation and resolution of Elavon PED processing issues, partnering with store teams to execute end-to-end
     test transactions; validated tipping configuration and ensured seamless integration for POS system payment along
     with mobile orders for card-present and card-not-present scenarios
  ● Analyzed system configuration for Starbucks Connect stores, scheduling procedures to address bug fixes and
     producing server endpoint credentials for Starbucks stores being staged (RDP/Kaseya)
  ● Collaborated with internal business and IT teams (CSM/TAM) to assist with bi-monthly projects along with active
     problems, strategizing long-term resolutions for ongoing issues reported to Starbucks service desk (NCR)
  ● Reviewed benefits developed from system improvements, assessed possible bottlenecks and major impacts on
     the business stakeholders. Producing prompt and thorough communication with individual end-users (Salesforce)
  ● Assisted with testing and implementing system updates to help with the integration between cross-functional
     team applications, while keeping Confluence KBA's & SOP's up to date with procedural findings (Atlassian)
  ● Created a variety of reports with detailed filters to provide advanced dashboards and metrics on performance
  ● Worked with internal IT and business partners to aid with standardizing successful deployment plans for
     Starbucks Connect store system upgrades, ensuring optimal performance and reliability (Microsoft Office 365)
  ● Ran queries (Splunk) for approximate data analysis on issues reported to the service desk

  2014 - 2020 Systems Analyst - Holland America Line, Seattle WA
  ● Primary support for all shipboard applications including Oracle's ERP hotel property management system, analyzing
     system capabilities, and gathering requirements to improve business processes for fleet systems
  ● Managed and prioritized active production support incidents (ServiceNow) based on urgency and complexity
  ● Expert in agile scrum project management, hosting sprint meetings with business users, Jira backlog grooming
     (Atlassian), and retrospective meetings to highlight accomplishments along with areas for process improvements
  ● Maintained scheduled automated jobs for IT, HR, OBR, GEPD, logistics and nautical teams helping optimize process
     workflows and improve overall performance by 60% with successful (.dta) file transfers, while ensuring ship POS
     menu items were configured correctly and reflecting active available items (Oracle Simphony 9500)
  ● Collaborated with cross-functional teams to assess customer needs, working with product owners, business users,
     and DevOps to implement high value features, increasing guest satisfaction and revenue (Microsoft Dynamics 365)
  ● Strong communication skills, collaborating with business users on consumer enhancement requests integrated
     with existing systems, uploading enhancements in UAT, and confirm end user approval in QA before deployment
  ● Produced 25+ data reports using ServiceNow, Crystal, Excel (data validation/pivot tables) to create dynamic
     presentations showing application trends and analysis to identify system bottlenecks (ITSM)
  ● Project Manager for 6 business and IT initiatives, outlining project scope, and ensuring both technical and business
     impacts have been assessed for architecture review, increasing project consistency by an average of 20%
  ● Assisted risk advisory and governance team with SOX audits, identifying potential risks with compliance impacts
  ● Supported system data and functions including itinerary, procurement, inventory, supply chain, finance, and
     eCommerce. Ensuring successful ship to shore data transfers to address any new passenger request changes
  ● Assisted with running manual SQL scripts via Scriptrunner (Toad), deploying report files fleet-wide (FTP), and
     facilitating manual workarounds during known maintenance outage windows
  ● Created and maintained system documentation SOP and Wiki KBA's within Confluence (Atlassian)

  Education
  Central Washington University - Ellensburg WA
  Bachelor of Science - Information Technology and Administrative Management
  `;
  
  return resumeText;
};

// Run the analysis
async function runGapAnalysis() {
  try {
    console.log('Starting gap analysis test...');
    
    // Get the resume text
    const resumeText = extractResumeText();
    console.log(`Resume text length: ${resumeText.length} characters`);
    
    // Run the matching analysis
    console.log('Running resume-to-job analysis...');
    const results = await matchResumeToJob(resumeText, jobDescription);
    
    // Display the results
    console.log('\n---- MATCH RESULTS ----');
    console.log(`Match Score: ${results.score}%`);
    
    console.log('\n---- STRENGTHS ----');
    results.strengths.forEach((strength, i) => {
      console.log(`${i+1}. ${strength}`);
    });
    
    console.log('\n---- WEAKNESSES ----');
    results.weaknesses.forEach((weakness, i) => {
      console.log(`${i+1}. ${weakness}`);
    });
    
    // Display the enhanced gap details
    console.log('\n---- DETAILED GAP ANALYSIS ----');
    if (results.gapDetails && results.gapDetails.length > 0) {
      results.gapDetails.forEach((gapDetail, i) => {
        console.log(`\nGAP CATEGORY ${i+1}: ${gapDetail.category} (${gapDetail.importance})`);
        console.log(`Impact: ${gapDetail.impact}`);
        
        console.log('Specific Gaps:');
        gapDetail.gaps.forEach((gap, j) => {
          console.log(`  ${j+1}. ${gap}`);
        });
        
        console.log('Suggestions:');
        gapDetail.suggestions.forEach((suggestion, j) => {
          console.log(`  ${j+1}. ${suggestion}`);
        });
      });
    } else {
      console.log('No detailed gap analysis available.');
    }
    
    // Save results to file for inspection
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    fs.writeFileSync(
      path.join(__dirname, 'gap_analysis_results.json'), 
      JSON.stringify(results, null, 2)
    );
    
    console.log('\nResults saved to gap_analysis_results.json');
    
  } catch (error) {
    console.error('Error running gap analysis:', error);
  }
}

// Run the analysis
runGapAnalysis().catch(console.error);