// Simple test script for OpenAI integration
import fetch from 'node-fetch';

// Sample resume text for testing
const resumeText = `
PROFESSIONAL EXPERIENCE

Senior Software Engineer, Microsoft
January 2019 - Present
- Lead developer for Azure DevOps integration services
- Architected and implemented microservices using Node.js and TypeScript
- Managed a team of 5 engineers for the real-time collaboration feature
- Reduced API response time by 40% through performance optimizations

Software Developer, Amazon Web Services
March 2015 - December 2018
- Developed serverless applications using AWS Lambda and API Gateway
- Implemented CI/CD pipelines using AWS CodePipeline and GitHub Actions
- Created data visualization dashboards with React and D3.js
- Worked with clients like Netflix and Airbnb on cloud migration projects

EDUCATION
Master of Computer Science, Stanford University, 2015
Bachelor of Science in Computer Engineering, MIT, 2013

SKILLS
Programming Languages: JavaScript, TypeScript, Python, Java, C++
Frameworks: React, Node.js, Express, Spring Boot, Django
Cloud: AWS, Azure, Google Cloud Platform
Tools: Git, Docker, Kubernetes, Jenkins, Terraform
`;

// Sample job description for testing
const jobDescription = `
Senior Full Stack Developer

We are looking for a Senior Full Stack Developer to join our growing team. The ideal candidate will have strong experience with React, Node.js, and cloud technologies.

Responsibilities:
- Design and implement new features for our web applications
- Work with the product team to define requirements and specifications
- Optimize applications for maximum speed and scalability
- Create reusable code and libraries for future use

Requirements:
- 5+ years of experience in web development
- Strong proficiency in JavaScript, TypeScript, and React
- Experience with Node.js and Express
- Familiarity with AWS or Azure cloud services
- Experience with CI/CD pipelines and containerization
- Excellent communication skills and ability to work in a team
`;

async function testResumeAnalysis() {
  try {
    console.log('Testing resume analysis...');
    const response = await fetch('http://localhost:5000/api/openai/analyze-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: resumeText }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Resume analysis result:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Resume analysis test failed:', error.message);
  }
}

async function testResumeMatching(resumeText, jobDescription) {
  try {
    console.log('\nTesting resume to job matching...');
    const response = await fetch('http://localhost:5000/api/openai/match-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        resumeText, 
        jobDescription 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Resume matching result:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Resume matching test failed:', error.message);
  }
}

// Run the tests
(async () => {
  await testResumeAnalysis();
  await testResumeMatching(resumeText, jobDescription);
})();