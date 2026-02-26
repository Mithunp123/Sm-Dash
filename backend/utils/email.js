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
