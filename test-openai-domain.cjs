/**
 * Test script for the domain-specific gap analysis using CommonJS syntax
 */

// CommonJS imports
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeResumeForDomainExpertise() {
  try {
    const resumeText = `
    Drew Corrigan
    Product Manager | Technologist | Strategic Thinker

    EXPERIENCE
    SENIOR PRODUCT MANAGER
    Wealthfront • Full-Time • Oct 2021 - Feb 2024 • 2 yrs 5 mos
    Mountain View, California, United States

    Managing the Cash account product. Shipping features that allow our clients to get the most out of their cash and manage their finances more confidently.

    LEAD PRODUCT MANAGER
    Finix Payments • Full-Time • Feb 2020 - Oct 2021 • 1 yr 9 mos
    San Francisco Bay Area

    Leading the core payments products and platform capabilities. Managing the payments roadmap and priorities and working with customers to understand and solve their problems.

    SENIOR PRODUCT MANAGER
    Finix Payments • Full-Time • May 2018 - Feb 2020 • 1 yr 10 mos
    San Francisco Bay Area

    Managing and shipping best in class payments experiences for our merchants, helping them create the best payments experiences for their customers. Building robust capabilities to help merchants understand how their business is performing.

    PRODUCT MANAGER
    Visa • Full-Time • Jul 2017 - May 2018 • 11 mos
    San Francisco Bay Area

    Led Visa's internal Data Science Platform for Visa Research.

    SR PRODUCT AND TECHNOLOGY MANAGER
    Tilt, acquired by Airbnb • Full-Time • May 2015 - Jul 2017 • 2 yrs 3 mos
    San Francisco Bay Area

    After Tilt's acquisition by Airbnb in early 2017, joined the Airbnb Payments team working on integrating the Tilt product into Airbnb's platform
    Manager for the API and backend services team
    Designed payment flows, API Schema, and scaling architecture
    Managed technical implementations and specifications for international expansion
    Built reporting for payment operations, reconciliation, and transaction history
    Implemented 3rd party integrations with payment processors, KYC, and fraud vendors

    EDUCATION
    GEORGIA INSTITUTE OF TECHNOLOGY
    Bachelor of Science - BS, Computational Media • 2013

    SKILLS
    JavaScript • Product Management • SQL • Full-Stack Development • React.js • Node.js • PostgreSQL
    `;
    
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
    
    console.log("Analyzing resume for domain-specific expertise gaps...");
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert resume analyst specializing in domain-specific gap analysis. 
            Your task is to identify key domain-specific gaps between a candidate's resume and a job description, 
            focusing specifically on payment industry expertise.
            
            Analyze the following domains:
            1. Payment processing systems knowledge
            2. Experience with payment service providers and gateways
            3. Security and compliance expertise in payments
            4. Technical implementation experience in payment systems
            5. Domain-specific technologies in payment processing
            
            For each domain, provide:
            - A list of specific gaps
            - The importance of each gap (Critical, Important, or Minor)
            - The potential impact of these gaps on job performance
            - Suggestions to address the gaps`
        },
        {
          role: "user",
          content: `Compare this resume and job description to identify domain-specific expertise gaps:
          
          RESUME:
          ${resumeText}
          
          JOB DESCRIPTION:
          ${jobDescription}
          
          Please structure your analysis in JSON format with the following schema:
          {
            "overallScore": number, // 0-100 match score
            "domainKnowledgeScore": number, // 0-100 payment domain knowledge score
            "domainExpertiseGaps": string[], // Array of domain-specific gaps specific to payment industry
            "strengths": string[], // Array of strengths related to the job
            "gapDetails": [ // Detailed analysis by domain
              {
                "category": string, // Domain category
                "importance": string, // "Critical", "Important", or "Minor"
                "gaps": string[], // Specific gaps in this domain
                "impact": string, // Impact description
                "suggestions": string[] // Suggestions to address gaps
              }
            ]
          }`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    
    // Parse and display results
    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    console.log("\n=== DOMAIN-SPECIFIC GAP ANALYSIS RESULTS ===\n");
    console.log(`Overall match score: ${analysisResult.overallScore}`);
    console.log(`Domain knowledge score: ${analysisResult.domainKnowledgeScore}`);
    
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
        console.log("Suggestions:");
        detail.suggestions.forEach(suggestion => console.log(`- ${suggestion}`));
      });
    } else {
      console.log("No detailed gap analysis available");
    }
    
    // Save the result
    require('fs').writeFileSync('openai_domain_analysis.json', JSON.stringify(analysisResult, null, 2));
    console.log("\nFull analysis saved to openai_domain_analysis.json");
    
  } catch (error) {
    console.error("Error in OpenAI analysis:", error);
  }
}

// Run the analysis
analyzeResumeForDomainExpertise();