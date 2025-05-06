/**
 * Test script for the domain-specific expertise analysis
 * This will analyze a resume against a payment industry job description
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const mammoth = require('mammoth');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extract text from a DOCX file
 * @param {string} filePath - Path to the DOCX file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromDocx(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error("Error extracting text from DOCX:", error);
    throw error;
  }
}

/**
 * Analyze a resume with OpenAI for domain-specific expertise
 * @param {string} resumeText - The extracted resume text
 * @param {string} jobDescription - The payment-related job description
 */
async function analyzeDomainExpertise(resumeText, jobDescription) {
  try {
    console.log("Starting domain expertise analysis with OpenAI...");
    console.log("Resume length:", resumeText.length);
    console.log("Job description length:", jobDescription.length);

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer specializing in technical roles with deep domain knowledge across industries. " +
            "You have particular expertise in analyzing payment systems, financial technology, and e-commerce platforms. " +
            "Your strength is identifying specific, nuanced gaps between a candidate's experience and job requirements. " +
            "You are precise in identifying domain-specific missing expertise rather than generic skill gaps. " +
            "For payment industry roles, identify deep domain-specific gaps like 'Limited experience with tokenization security standards for card data storage' rather than vague skills. " +
            "Carefully identify expertise areas that directly impact the candidates' ability to excel in the exact industry context of the job."
        },
        {
          role: "user",
          content: 
            `I need you to analyze this resume for compatibility with the following job description, with special focus on specific domain expertise gaps.
            
            Resume:
            ${resumeText}
            
            Job Description:
            ${jobDescription}
            
            IMPORTANT - DOMAIN-SPECIFIC ANALYSIS INSTRUCTIONS:
            1. Identify detailed, domain-specific expertise gaps between the resume and job requirements
            2. Focus on concrete expertise areas mentioned in the job description but missing in the resume
            3. Be very detailed about industry-specific knowledge missing, like "Limited experience with card-present vs. card-not-present payment flows"
            4. For each significant gap, provide:
               a) The precise nature of the domain expertise gap (be highly specific to the job's industry)
               b) The level of importance of this domain knowledge to the role (critical, important, nice-to-have)
               c) Why this specific expertise matters for this exact role
            5. Calculate a domain knowledge score (0-100) based on how well the candidate's experience matches industry-specific requirements
            
            Return your analysis in a structured JSON format with the following fields:
            - domainExpertiseGaps (array of strings: specific domain expertise areas missing)
            - domainKnowledgeScore (number 0-100: indicating domain-specific knowledge level)
            - gapDetails: [
              {
                category: string, // e.g., "Payment Processing Expertise", "Financial Systems Knowledge"
                gaps: string[], // Domain-specific gaps in this category (very detailed)
                importance: string, // "Critical", "Important", or "Nice-to-have"
                impact: string, // How this domain expertise gap specifically impacts the role
                suggestions: string[] // Actionable ways to address this domain-specific gap
              }
            ]`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2000,
    });

    // Parse the analysis
    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Display the domain expertise analysis
    console.log("\n=== DOMAIN EXPERTISE ANALYSIS ===");
    console.log(`Domain Knowledge Score: ${analysis.domainKnowledgeScore}/100`);
    
    console.log("\nDomain Expertise Gaps:");
    analysis.domainExpertiseGaps.forEach((gap, i) => {
      console.log(`${i+1}. ${gap}`);
    });
    
    console.log("\nDetailed Gap Analysis by Category:");
    analysis.gapDetails.forEach((category, i) => {
      console.log(`\nCategory: ${category.category} (${category.importance})`);
      console.log(`Impact: ${category.impact}`);
      
      console.log("Specific Gaps:");
      category.gaps.forEach((gap, j) => {
        console.log(`  ${j+1}. ${gap}`);
      });
      
      console.log("Suggestions:");
      category.suggestions.forEach((suggestion, j) => {
        console.log(`  ${j+1}. ${suggestion}`);
      });
    });
    
    // Save the analysis to a file for reference
    fs.writeFileSync(
      'domain_expertise_analysis.json', 
      JSON.stringify(analysis, null, 2)
    );
    console.log("\nFull analysis saved to domain_expertise_analysis.json");
    
    return analysis;
  } catch (error) {
    console.error("Error during domain expertise analysis:", error);
    throw error;
  }
}

/**
 * Main function to run the test
 */
async function main() {
  try {
    // Path to resume file (using Drew's CV as a test case)
    const resumePath = path.join(__dirname, 'attached_assets', 'Drew Corrigan - CV.pdf');
    
    // Define a payment processing related job description
    const paymentJobDescription = `
    Senior Payment Systems Analyst
    
    Job Description:
    We are seeking an experienced Payment Systems Analyst to join our financial technology team. The ideal candidate will have deep expertise in payment processing systems, transaction flows, and security protocols. You will be responsible for analyzing, designing, and optimizing our payment infrastructure to ensure seamless and secure transaction processing.
    
    Key Responsibilities:
    - Design and implement payment processing workflows for both card-present and card-not-present transactions
    - Configure and manage payment gateways, processors, and acquirer integrations
    - Implement tokenization and encryption protocols for secure card data handling
    - Develop and maintain PCI-DSS compliant payment systems
    - Analyze transaction flows and optimize for conversion rates and fraud prevention
    - Troubleshoot payment failures and reconciliation issues
    - Create documentation for payment integration procedures
    
    Required Skills and Experience:
    - 5+ years of experience in payment systems architecture or engineering
    - Deep understanding of credit card processing, ACH, and alternative payment methods
    - Experience with major payment gateways (Stripe, PayPal, Adyen, Braintree)
    - Knowledge of EMV chip technology and contactless payment systems
    - Familiarity with PCI-DSS requirements and compliance procedures
    - Experience with tokenization and encryption techniques for payment data
    - Understanding of ISO 8583 message format for financial transactions
    - Proficiency in SQL for payment data analysis
    
    Nice to Have:
    - Experience with 3D Secure 2.0 implementation
    - Knowledge of recurring billing and subscription payment models
    - Familiarity with fraud detection systems and risk scoring
    - Experience with international payment methods and cross-border transactions
    `;
    
    // First check if we're using a DOCX file (use mammoth) or PDF (handle differently)
    let resumeText;
    if (resumePath.endsWith('.docx')) {
      resumeText = await extractTextFromDocx(resumePath);
    } else if (resumePath.endsWith('.pdf')) {
      console.log("PDF processing not implemented in this simple test script");
      console.log("Please convert the PDF to text manually or use a DOCX file");
      process.exit(1);
    } else {
      // Assume it's a plain text file
      resumeText = fs.readFileSync(resumePath, 'utf8');
    }
    
    // Analyze the resume for domain-specific expertise
    await analyzeDomainExpertise(resumeText, paymentJobDescription);
    
  } catch (error) {
    console.error("Error in domain expertise analysis test:", error);
  }
}

// Run the test
main();