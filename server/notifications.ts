import { sendEmail, createEmailTemplate } from "./email";
import { storage } from "./storage";
import type { Job, User } from "@shared/schema";

/**
 * Notification service for handling various system notifications
 */
export class NotificationService {
  
  /**
   * Send job assignment notification to a recruiter
   */
  static async sendJobAssignmentNotification(job: Job, recruiter: User): Promise<boolean> {
    try {
      if (!recruiter.email) {
        console.warn(`Recruiter ${recruiter.name} (ID: ${recruiter.id}) has no email address`);
        return false;
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

      const success = await sendEmail(recruiter.email, subject, emailContent);
      
      if (success) {
        console.log(`Job assignment notification sent to ${recruiter.name} (${recruiter.email}) for job: ${job.jobId}`);
      } else {
        console.error(`Failed to send job assignment notification to ${recruiter.name} (${recruiter.email})`);
      }
      
      return success;
    } catch (error) {
      console.error(`Error sending job assignment notification to recruiter ${recruiter.id}:`, error);
      return false;
    }
  }

  /**
   * Send job assignment notifications to multiple recruiters
   */
  static async sendJobAssignmentNotifications(job: Job, recruiterIds: number[]): Promise<void> {
    const notifications = recruiterIds.map(async (recruiterId) => {
      try {
        const recruiter = await storage.getUser(recruiterId);
        if (recruiter) {
          await this.sendJobAssignmentNotification(job, recruiter);
        }
      } catch (error) {
        console.error(`Failed to send notification to recruiter ${recruiterId}:`, error);
        // Continue processing other notifications even if one fails
      }
    });

    // Process all notifications concurrently
    await Promise.allSettled(notifications);
  }
}