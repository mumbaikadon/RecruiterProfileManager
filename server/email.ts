import * as nodemailer from 'nodemailer';
import { logger } from './logger';

// Define attachment interface
export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

// Function to send email using Gmail SMTP via nodemailer
export const sendEmail = async (
  to: string, 
  subject: string, 
  htmlContent: string, 
  attachments?: Attachment[]
): Promise<boolean> => {
  // Get the credentials from environment variables
  const username = process.env.EMAIL_USER || '';
  const password = process.env.EMAIL_PASS || '';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587'); // Using port 587 for STARTTLS
  const ccEmail = process.env.CC_EMAIL || '';
  
  if (!username || !password) {
    logger.error('Email credentials not found. Please set EMAIL_USER and EMAIL_PASS environment variables.');
    return false;
  }
  
  try {
    // Log the email attempt
    logger.info(`----- SENDING EMAIL VIA GMAIL SMTP -----`);
    logger.info(`From: ${username}`);
    logger.info(`To: ${to}`);
    logger.info(`Subject: ${subject}`);
    logger.info(`SMTP Server: ${smtpHost}:${smtpPort}`);
    
    // Create a nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // true for 465, false for other ports
      auth: {
        user: username,
        pass: password,
      },
    });
    
    // Define email options
    const mailOptions = {
      from: `"RecruiterProfileManager" <${username}>`,
      to: to,
      cc: ccEmail, // Include CC email if provided in env
      subject: subject,
      html: htmlContent,
      // Add text version for email clients that don't support HTML
      text: "This email requires HTML support to view properly.",
      // Include attachments if provided
      attachments: attachments || []
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent successfully to ${to}`);
    logger.info(`Message ID: ${info.messageId}`);
    logger.info(`----- EMAIL SENT -----`);
    
    return true;
  } catch (error) {
    logger.error('Error sending email:', error);
    logger.error(`----- EMAIL FAILED -----`);
    return false;
  }
};

// Helper function to create HTML email template
export const createEmailTemplate = (
  title: string,
  content: string,
  buttonText?: string,
  buttonUrl?: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #4a6cf7;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 20px;
          background-color: #f9f9f9;
        }
        .button {
          display: inline-block;
          background-color: #4a6cf7;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          text-align: center;
          padding: 10px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${content}
          ${buttonText && buttonUrl ? `<a href="${buttonUrl}" class="button">${buttonText}</a>` : ''}
        </div>
        <div class="footer">
          <p>This is an automated message from the RecruiterProfileManager system.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
