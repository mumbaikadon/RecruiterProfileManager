/**
 * Test script for testing the domain-specific gap analysis functionality
 * This will compare a resume against a payments-related job description
 */

const fs = require('fs');
const { matchResumeToJob } = require('./server/openai');

async function runDomainGapAnalysis() {
  try {
    // Load sample resume text
    console.log("Reading resume file...");
    const resumeText = fs.readFileSync('./attached_assets/Drew Corrigan - CV.pdf', 'utf8');
    
    // Create a payment industry focused job description
    const jobDescription = `
    Senior Software Engineer - Payment Systems

    Job Description:
    We are seeking an experienced Senior Software Engineer with deep expertise in payment processing systems. The ideal candidate will have a strong background in developing and maintaining complex payment gateways, transaction processing systems, and integrating with various payment service providers.

    Required Skills:
    - 5+ years of experience developing payment processing systems
    - Strong experience with payment card industry (PCI) compliance requirements
    - Experience integrating with major payment gateways (Stripe, PayPal, Braintree)
    - Expertise in handling real-time transaction processing
    - Knowledge of credit card tokenization and encryption best practices
    - Experience with fraud detection systems in payment processing
    - Strong background in REST API development for payment services
    - Experience with financial reconciliation processes

    Key Responsibilities:
    - Design and implement robust payment processing systems
    - Integrate with multiple payment service providers and financial institutions
    - Ensure all systems meet PCI-DSS compliance requirements
    - Implement security best practices for handling sensitive payment data
    - Create and maintain API documentation for payment services
    - Troubleshoot and resolve complex payment processing issues
    - Work with the security team to implement fraud detection measures

    Technologies:
    - Node.js, Express
    - Java for backend services
    - Strong SQL skills for financial data management
    - Experience with Redis or similar caching systems
    - AWS or Azure cloud infrastructure
    `;
    
    // Call the resume matching function with domain-specific focus
    console.log("Starting analysis...");
    const analysisResult = await matchResumeToJob(resumeText, jobDescription);
    
    // Log the detailed results
    console.log("\n=== DOMAIN-SPECIFIC GAP ANALYSIS RESULTS ===\n");
    console.log(`Overall match score: ${analysisResult.score}`);
    console.log(`Domain knowledge score: ${analysisResult.domainKnowledgeScore || 'Not available'}`);
    
    console.log("\nDomain-specific expertise gaps:");
    if (analysisResult.domainExpertiseGaps && analysisResult.domainExpertiseGaps.length > 0) {
      analysisResult.domainExpertiseGaps.forEach(gap => console.log(`- ${gap}`));
    } else {
      console.log("No domain-specific gaps detected");
    }
    
    console.log("\nDetailed gap analysis:");
    if (analysisResult.gapDetails && analysisResult.gapDetails.length > 0) {
      analysisResult.gapDetails.forEach(detail => {
        console.log(`\n${detail.category} (${detail.importance}):`);
        detail.gaps.forEach(gap => console.log(`- ${gap}`));
        console.log(`Impact: ${detail.impact}`);
      });
    } else {
      console.log("No detailed gap analysis available");
    }
    
    // Save the full analysis to a file for reference
    fs.writeFileSync('domain_gap_analysis_result.json', JSON.stringify(analysisResult, null, 2));
    console.log("\nFull analysis saved to domain_gap_analysis_result.json");
    
  } catch (error) {
    console.error("Error in domain gap analysis:", error);
  }
}

// Run the analysis
runDomainGapAnalysis();