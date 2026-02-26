import express from 'express';
import { getDatabase } from '../database/init.js';
import { sendEmail } from '../utils/email.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/mail/users
 * Get list of all users for recipient selection
 */
router.get('/users', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        db.all(
            'SELECT id, name, email, role FROM users WHERE email IS NOT NULL AND email != "" ORDER BY name ASC',
            [],
            (err, users) => {
                if (err) {
                    console.error('Error fetching users:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to fetch users'
                    });
                }

                res.json({
                    success: true,
                    users: users || [],
                    total: users?.length || 0
                });
            }
        );
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

/**
 * POST /api/mail/send-bulk
 * Send bulk emails to multiple recipients with template personalization
 */
router.post('/send-bulk', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { recipients, subject, body, html = false, type = 'other' } = req.body;

        // Validation
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Recipients list is required'
            });
        }

        if (!subject || !subject.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Subject is required'
            });
        }

        if (!body || !body.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Email body is required'
            });
        }

        // Check if user has admin privilege to send emails
        db.get('SELECT role FROM users WHERE id = ?', [req.user.userId], (err, currentUser) => {
            if (err) {
                console.error('Error checking user role:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify permissions'
                });
            }

            if (currentUser?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only admins can send bulk emails'
                });
            }

            let successful = 0;
            let failed = 0;
            const failedRecipients = [];

            // Send emails to each recipient
            (async () => {
                for (const recipientData of recipients) {
                    try {
                        // Handle both email string and user object
                        const email = typeof recipientData === 'string' ? 
                            recipientData : 
                            recipientData.email;

                        const name = typeof recipientData === 'string' ? 
                            'User' : 
                            (recipientData.name || 'User');

                        // Personalize email content
                        let personalizedBody = body
                            .replace(/\[Name\]/g, name)
                            .replace(/\[name\]/g, name)
                            .replace(/\{name\}/g, name)
                            .replace(/{{name}}/g, name);

                        let personalizedSubject = subject
                            .replace(/\[Name\]/g, name)
                            .replace(/\[name\]/g, name)
                            .replace(/\{name\}/g, name)
                            .replace(/{{name}}/g, name);

                        const emailContent = html ? personalizedBody : `<p>${personalizedBody.replace(/\n/g, '</p><p>')}</p>`;

                        const success = await sendEmail(email, personalizedSubject, emailContent);

                        if (success) {
                            successful++;
                        } else {
                            failed++;
                            failedRecipients.push({
                                email,
                                name,
                                reason: 'SMTP error'
                            });
                        }

                        // Small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 500));

                    } catch (error) {
                        console.error(`Error sending email to recipient:`, error);
                        failed++;
                        failedRecipients.push({
                            email: recipientData.email || recipientData,
                            name: recipientData.name || 'Unknown',
                            reason: error.message
                        });
                    }
                }

                // Log email sending activity
                db.run(
                    `INSERT INTO activity_logs (user_id, action, details, timestamp) 
                     VALUES (?, ?, ?, ?)`,
                    [
                        req.user.userId,
                        'SEND_BULK_EMAIL',
                        `Sent ${successful} emails, ${failed} failed. Type: ${type}`,
                        new Date().toISOString()
                    ],
                    (logErr) => {
                        if (logErr) {
                            console.warn('Failed to log email activity:', logErr);
                        }

                        res.json({
                            success: true,
                            message: `Email campaign completed. Sent: ${successful}, Failed: ${failed}`,
                            stats: {
                                successful,
                                failed,
                                total: recipients.length,
                                failedRecipients: failed > 0 ? failedRecipients : []
                            }
                        });
                    }
                );
            })();
        });
    } catch (error) {
        console.error('Error sending bulk emails:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send bulk emails',
            error: error.message
        });
    }
});

/**
 * GET /api/mail/templates
 * Get available email templates for each role
 */
router.get('/templates', authenticateToken, (req, res) => {
    const templates = {
        volunteer: {
            name: 'Volunteer',
            subject: 'Congratulations [Name]! - SM Volunteers',
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #1E3A8A; border-bottom: 2px solid #1E3A8A; padding-bottom: 10px; margin-top: 0;">Congratulations [Name]!</h2>
    
    <p style="font-size: 16px; color: #333;">Dear [Name],</p>
    
    <p style="font-size: 16px; line-height: 1.8; color: #333;">
      Congratulations! You have been successfully selected as a Volunteer at SM. 
      Your dedication, confidence, and commitment truly stood out.
    </p>
    
    <div style="background-color: #F8FAFC; padding: 15px; border-left: 4px solid #1E3A8A; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #333;"><strong>📌 Next Steps:</strong></p>
      <ul style="color: #333; margin: 10px 0 0 0;">
        <li>Join the official SM WhatsApp group</li>
        <li>Familiarize yourself with upcoming events</li>
        <li>Attend the orientation session</li>
      </ul>
    </div>
    
    <p style="font-size: 16px; margin-top: 20px; color: #333;">
      Achievements are earned through dedication and hard work.<br>
      <strong>We are excited to have you on board!</strong>
    </p>
    
    <p style="margin-top: 30px; color: #333;">Best regards,<br><strong>SM Volunteers Team</strong></p>
  </div>
</div>`
        },
        office_bearer: {
            name: 'Office Bearer',
            subject: 'Congratulations [Name]! - SM Volunteers',
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #1E3A8A; border-bottom: 2px solid #1E3A8A; padding-bottom: 10px; margin-top: 0;">Congratulations [Name]!</h2>
    
    <p style="font-size: 16px; color: #333;">Dear [Name],</p>
    
    <p style="font-size: 16px; line-height: 1.8; color: #333;">
      Congratulations! You have been successfully selected as an Office Bearer at SM. 
      Your dedication, confidence, and commitment truly stood out.
    </p>
    
    <div style="background-color: #F8FAFC; padding: 15px; border-left: 4px solid #1E3A8A; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #333;"><strong>📌 Role & Responsibilities:</strong></p>
      <p style="color: #333; margin: 10px 0 0 0;">
        You are assigned as an Office Bearer for this academic year. 
        This role assignment is final and seen as per the academic calendar.
      </p>
    </div>
    
    <div style="background-color: #F8FAFC; padding: 15px; border-left: 4px solid #1E3A8A; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #333;"><strong>📌 Next Steps:</strong></p>
      <ul style="color: #333; margin: 10px 0 0 0;">
        <li>Join the official SM WhatsApp group for office bearers</li>
        <li>Attend the mandatory orientation session</li>
        <li>Review the office bearer guidelines</li>
      </ul>
    </div>
    
    <p style="font-size: 16px; margin-top: 20px; color: #333;">
      Achievements are earned through dedication and hard work.<br>
      <strong>We are excited to have you on board!</strong>
    </p>
    
    <p style="margin-top: 30px; color: #333;">Best regards,<br><strong>SM Volunteers Team</strong></p>
  </div>
</div>`
        }
    };

    res.json({
        success: true,
        templates
    });
});

export default router;
