import fetch from 'node-fetch';
import { candidates, submissions, jobs } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Simple logger
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`)
};

// URL for the TalentStreamline microservice API
const TALENT_STREAMLINE_URL = process.env.TALENT_STREAMLINE_URL || 'https://api.talentstreamline.example/v1';
const API_KEY = process.env.TALENT_STREAMLINE_API_KEY;

/**
 * Send candidate information to TalentStreamline when their submission status is set to "Offer Accepted"
 */
export async function syncCandidateToTalentStreamline(submissionId: number): Promise<boolean> {
  try {
    // Get the submission with related candidate and job information
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId)
    });

    if (!submission) {
      logger.error(`Cannot sync to TalentStreamline: Submission #${submissionId} not found`);
      return false;
    }

    // Only send data for "Offer Accepted" status
    if (submission.status !== 'Offer Accepted') {
      logger.info(`Skipping sync for submission #${submissionId} with status: ${submission.status}`);
      return false;
    }

    // Get candidate information
    const candidate = await db.query.candidates.findFirst({
      where: eq(candidates.id, submission.candidateId)
    });

    if (!candidate) {
      logger.error(`Cannot sync to TalentStreamline: Candidate not found for submission #${submissionId}`);
      return false;
    }

    // Get job information
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, submission.jobId)
    });

    if (!job) {
      logger.error(`Cannot sync to TalentStreamline: Job not found for submission #${submissionId}`);
      return false;
    }

    // Format the candidate data for the TalentStreamline API
    const candidateData = {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location,
      jobTitle: job.title,
      jobId: job.jobId,
      agreedRate: submission.agreedRate,
      offerAcceptedDate: new Date().toISOString(),
      submissionId: submission.id,
      status: submission.status
    };

    // Send data to TalentStreamline API
    const response = await fetch(`${TALENT_STREAMLINE_URL}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-System-Source': 'TalentPipeline'
      },
      body: JSON.stringify(candidateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to sync candidate to TalentStreamline: ${errorText}`);
      return false;
    }

    logger.info(`Successfully synced candidate #${submission.candidate.id} to TalentStreamline`);
    return true;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    logger.error(`Error syncing candidate to TalentStreamline: ${errorMessage}`);
    return false;
  }
}