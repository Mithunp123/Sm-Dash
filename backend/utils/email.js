import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000,
    });
};

/**
 * Sends an email using the configured SMTP transporter
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email body (HTML)
 * @returns {Promise<boolean>} - True if sent, false otherwise
 */
export const sendEmail = async (to, subject, html) => {
    const transporter = createTransporter();

    if (!transporter) {
        console.error('❌ SMTP not configured! Missing env variables:');
        console.error('   - SMTP_HOST:', process.env.SMTP_HOST ? '✓' : '✗');
        console.error('   - SMTP_USER:', process.env.SMTP_USER ? '✓' : '✗');
        console.error('   - SMTP_PASS:', process.env.SMTP_PASS ? '✓' : '✗');
        console.error('   - SMTP_PORT:', process.env.SMTP_PORT ? '✓' : '✗');
        return false;
    }

    try {
        // Verify connection before sending
        await transporter.verify();
        console.log('✓ SMTP connection verified');

        const result = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
        });

        console.log(`✓ Email sent successfully to ${to} (Message ID: ${result.messageId})`);
        return true;
    } catch (error) {
        console.error(`✗ Failed to send email to ${to}:`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        if (error.response) {
            console.error(`   Response: ${error.response}`);
        }
        return false;
    }
};

/**
 * Generates the HTML template for OTP email
 * @param {string} otp - The 6-digit OTP
 * @returns {string} HTML string
 */
export const getOTPEmailTemplate = (otp) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #ea580c; margin-top: 0;">Password Reset Request</h2>
        <p>Hi,</p>
        <p>You requested a password reset for your account. Use the code below to reset your password:</p>
        <div style="background-color: #fff7ed; border: 2px solid #ea580c; border-radius: 6px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #666; margin-bottom: 10px;">Your Password Reset Code:</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #ea580c; letter-spacing: 5px;">${otp}</p>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          This is an automated email. Please do not reply to this message.
        </p>
      </div>
    </div>
  `;
};

/**
 * Generates the HTML template for interview invitation email
 * @param {string} name - Candidate name
 * @param {string} registerNo - Registration number
 * @returns {string} HTML string
 */
export const getInterviewEmailTemplate = (name, registerNo) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #2563eb; margin-top: 0;">Interview Registration Successful</h2>
        <p>Dear ${name},</p>
        <p>Welcome! You have been successfully registered for the <strong>SM Volunteers Interview Process</strong>.</p>
        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Registration Details:</strong></p>
          <p style="margin: 5px 0;"><strong>Registration Number:</strong> ${registerNo}</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">Keep this information for your records.</p>
        </div>

        <p>We will notify you shortly about:</p>
        <ul style="color: #666; font-size: 14px;">
          <li>Interview date and time</li>
          <li>Interview venue and format</li>
          <li>Required documents</li>
          <li>Additional instructions</li>
        </ul>

        <p style="margin-top: 20px; color: #666;">If you have any questions, please reach out to us. We look forward to meeting you!</p>

        <p style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <strong>Best Regards,</strong><br/>
          SM Volunteers Team
        </p>
        
        <p style="color: #999; font-size: 12px; margin-top: 15px;">
          This is an automated email. Please do not reply to this message. For queries, contact us through the official website.
        </p>
      </div>
    </div>
  `;
};

export const getInterviewOutcomeTemplate = ({name, decision, interviewerName, interviewDate, interviewTime, decisionLink}) => {
    const decisions = {
        selected: {
            heading: '🎉 Congratulations! You are Selected',
            color: '#059669',
            text: 'You have been <strong>selected</strong> for the SM Volunteers program. Welcome aboard!'
        },
        waitlisted: {
            heading: '⏳ You are Waitlisted',
            color: '#d97706',
            text: 'You have been placed on the waitlist. We will keep you updated as slots open up.'
        },
        rejected: {
            heading: '❌ Application Not Selected',
            color: '#dc2626',
            text: 'This round did not work out. Keep improving and please reapply in future cycles.'
        },
        retake: {
            heading: '🔁 Interview Marked Absent / Retake',
            color: '#f59e0b',
            text: 'You are marked as absent today. We will share a retake schedule shortly.'
        }
    };

    const decisionKey = decision && decisions[decision] ? decision : 'waitlisted';
    const data = decisions[decisionKey];

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f8fafc;">
      <div style="background:#fff; padding:30px; border-radius:10px; box-shadow:0 3px 8px rgba(0,0,0,0.12);">
        <h2 style="color:${data.color}; margin-bottom:8px;">${data.heading}</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p style="font-size:15px;">${data.text}</p>

        <div style="background:#f3f4f6; border-left:4px solid ${data.color}; padding:14px; border-radius:6px; margin:18px 0;">
          <p style="margin:2px 0;"><strong>Interviewer:</strong> ${interviewerName || 'Not assigned yet'}</p>
          <p style="margin:2px 0;"><strong>Interview Date:</strong> ${interviewDate || 'To be scheduled'}</p>
          <p style="margin:2px 0;"><strong>Interview Time:</strong> ${interviewTime || 'To be scheduled'}</p>
        </div>

        <p style="font-size:14px;">For complete details and further action, please follow the link below:</p>
        <p style="text-align:center; margin:18px 0;"><a href="${decisionLink || '#'}" style="background:${data.color}; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; display:inline-block; font-weight:bold;">View Interview Status</a></p>

        <p style="font-size:13px; color:#6b7280;">This is an automated message. Do not reply directly to this email.</p>
      </div>
    </div>`;
};

export const getInterviewAssignmentTemplate = ({name, mentorName, interviewDate, interviewTime, detailsLink}) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9fafb;">
      <div style="background:#ffffff; padding: 30px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #0f172a; margin-top: 0;">Interview Assignment Update</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>You have been assigned to <strong>mentor ${mentorName}</strong>.</p>
        <p><strong>Scheduled date:</strong> ${interviewDate || 'Not set yet'}</p>
        <p><strong>Scheduled time:</strong> ${interviewTime || 'Not set yet'}</p>

        <div style="text-align:center; margin: 25px 0;">
          <a href="${detailsLink || '#'}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;">View Interview Details</a>
        </div>

        <p style="font-size:13px;color:#6b7280;">If your interview date/time changes, we will send an update automatically.</p>
      </div>
    </div>`;
};
