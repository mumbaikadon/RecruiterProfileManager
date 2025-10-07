import { sendEmail, createEmailTemplate, Attachment } from "./email";
import { storage } from "./storage";
import type { Job, User, Candidate, Submission } from "@shared/schema";

/**
 * Notification service for handling various system notifications
 */
export class NotificationService {
  
  /**
   * Send job assignment notification to a recruiter
   * Returns the Message-ID for email threading, or null if failed
   * @param assignmentId - The job assignment ID to update with Message-ID
   */
  static async sendJobAssignmentNotification(job: Job, recruiter: User, assignmentId?: number): Promise<string | null> {
    try {
      if (!recruiter.email) {
        console.warn(`Recruiter ${recruiter.name} (ID: ${recruiter.id}) has no email address`);
        return null;
      }

      const subject = `New Job Assignment: ${job.title} (${job.jobId})`;
      
      const emailContent = createEmailTemplate(
        "New Job Assignment",
        `
          <p>Hello ${recruiter.name},</p>
          <p>You have been assigned to a new job:</p>
          <h3>${job.title}</h3>
          <p><strong>Job ID:</strong> ${job.jobId}</p>
          <p><strong>Client:</strong> ${job.client || 'Not specified'}</p>
          <p><strong>Location:</strong> ${job.city ? `${job.city}, ${job.state}` : 'Not specified'}</p>
          <p><strong>Job Type:</strong> ${job.jobType || 'Not specified'}</p>
          <p><strong>Rate:</strong> ${job.rate || 'Not specified'}</p>
          ${job.requiredSkills && job.requiredSkills.length > 0 ? 
            `<p><strong>Required Skills:</strong> ${job.requiredSkills.join(', ')}</p>` : ''
          }
          <p><strong>Description:</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
            ${job.description.replace(/\n/g, '<br>')}
          </div>
          <p>Please log into the RecruiterTracker system to start working on this assignment.</p>
        `,
        "View Job Details",
        `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/jobs/${job.id}`
      );

      const messageId = await sendEmail(recruiter.email, subject, emailContent);
      
      if (messageId) {
        console.log(`Job assignment notification sent to ${recruiter.name} (${recruiter.email}) for job: ${job.jobId}`);
        console.log(`Email Message-ID: ${messageId}`);
        
        // Store Message-ID on the job assignment if assignment ID is provided
        if (assignmentId) {
          try {
            await storage.updateJobAssignment(assignmentId, {
              emailMessageId: messageId,
              emailThreadReferences: messageId
            });
            console.log(`Stored Message-ID on assignment ${assignmentId}`);
          } catch (error) {
            console.error(`Failed to store Message-ID on assignment ${assignmentId}:`, error);
          }
        }
      } else {
        console.error(`Failed to send job assignment notification to ${recruiter.name} (${recruiter.email})`);
      }
      
      return messageId;
    } catch (error) {
      console.error(`Error sending job assignment notification to recruiter ${recruiter.id}:`, error);
      return null;
    }
  }

  /**
   * Send job assignment notifications to multiple recruiters
   * Each recruiter gets their own Message-ID stored on their assignment
   */
  static async sendJobAssignmentNotifications(job: Job, recruiterIds: number[]): Promise<void> {
    const notifications = recruiterIds.map(async (recruiterId) => {
      try {
        const recruiter = await storage.getUser(recruiterId);
        if (recruiter) {
          // Get the assignment to pass its ID for Message-ID storage
          const assignment = await storage.getJobAssignmentByJobAndUser(job.id, recruiterId);
          if (assignment) {
            await this.sendJobAssignmentNotification(job, recruiter, assignment.id);
          } else {
            // If no assignment found, send notification without storing Message-ID
            await this.sendJobAssignmentNotification(job, recruiter);
          }
        }
      } catch (error) {
        console.error(`Failed to send notification to recruiter ${recruiterId}:`, error);
      }
    });

    // Process all notifications concurrently
    await Promise.allSettled(notifications);
  }

  /**
   * Send candidate submission notification to assigned recruiters
   * Uses email threading to reply in the same conversation as job assignment
   */
  static async sendSubmissionNotification(
    job: Job,
    candidate: Candidate,
    submission: Submission,
    recruiter: User,
    fileName: string | null,
    fileContent: Buffer | null,
    fileType: string | null
  ): Promise<boolean> {
    try {
      if (!recruiter.email) {
        console.warn(`Recruiter ${recruiter.name} (ID: ${recruiter.id}) has no email address`);
        return false;
      }

      const subject = `Re: New Submission on Job Assignment: ${job.title} (${job.jobId})`;
      
      const emailContent = createEmailTemplate(
        "New Candidate Submission",
        `
          <p>Hello ${recruiter.name},</p>
          <p>A new candidate has been submitted for <strong>${job.title}</strong> (${job.jobId}):</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0;">
            <h3 style="margin-top: 0;">${candidate.firstName} ${candidate.lastName}</h3>
            <p><strong>Match Score:</strong> ${submission.matchScore}%</p>
            <p><strong>Status:</strong> ${submission.status}</p>
            <p><strong>Rate:</strong> $${submission.agreedRate}/hr</p>
            ${submission.notes ? `<p><strong>Notes:</strong> ${submission.notes}</p>` : ''}
          </div>
          
          <p><strong>Candidate Details:</strong></p>
          <ul>
            <li><strong>Email:</strong> ${candidate.email || 'Not provided'}</li>
            <li><strong>Phone:</strong> ${candidate.phone || 'Not provided'}</li>
            <li><strong>Location:</strong> ${candidate.location || 'Not provided'}</li>
            <li><strong>Work Authorization:</strong> ${candidate.workAuthorization || 'Not specified'}</li>
          </ul>
          
          <p>Please review the submission in the RecruiterTracker system.</p>
        `,
        "View Submission Details",
        `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/submissions/${submission.id}`
      );

      // Look up this recruiter's specific assignment to get their Message-ID
      const assignment = await storage.getJobAssignmentByJobAndUser(job.id, recruiter.id);
      
      // Use email threading if assignment has emailMessageId
      let threadingHeaders;
      if (assignment?.emailMessageId) {
        threadingHeaders = {
          inReplyTo: assignment.emailMessageId,
          references: assignment.emailThreadReferences || assignment.emailMessageId
        };
      }

      const attachments: Attachment[] = [];
      if (fileName && fileContent && fileType) {
        attachments.push({
          filename: fileName,
          content: fileContent,
          contentType: fileType
        });
      }

      const messageId = await sendEmail(
        recruiter.email, 
        subject, 
        emailContent,
        [], // no attachments
        threadingHeaders
      );
      
      if (messageId) {
        console.log(`Submission notification sent to ${recruiter.name} for job ${job.jobId}, candidate ${candidate.firstName} ${candidate.lastName}`);
        if (threadingHeaders) {
          console.log(`Email threaded with Message-ID: ${assignment!.emailMessageId}`);
          
          // Update the assignment's thread references to include this new Message-ID
          try {
            const updatedReferences = assignment!.emailThreadReferences 
              ? `${assignment!.emailThreadReferences} ${messageId}`
              : `${assignment!.emailMessageId} ${messageId}`;
            
            await storage.updateJobAssignment(assignment!.id, {
              emailThreadReferences: updatedReferences
            });
            console.log(`Updated thread references for assignment ${assignment!.id}`);
          } catch (error) {
            console.error(`Failed to update thread references:`, error);
          }
        }
        return true;
      } else {
        console.error(`Failed to send submission notification to ${recruiter.name}`);
        return false;
      }
    } catch (error) {
      console.error(`Error sending submission notification:`, error);
      return false;
    }
  }
}