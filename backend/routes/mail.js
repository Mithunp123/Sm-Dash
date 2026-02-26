import express from 'express';
import { getDatabase } from '../database/init.js';
import { sendEmail } from '../utils/email.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/mail/health
 * Test endpoint to verify server is running
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Mail service is running',
        timestamp: new Date().toISOString()
    });
});

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
router.post('/send-bulk', authenticateToken, async (req, res) => {
    console.log('📧 [MAIL] send-bulk endpoint called');
    console.log('👤 [MAIL] User ID:', req.user?.id, 'Email:', req.user?.email);
    
    try {
        const db = getDatabase();
        const { recipients, subject, body, html = false, type = 'other' } = req.body;

        console.log('📋 [MAIL] Request params:', { 
            recipientsCount: recipients?.length, 
            subject: subject?.substring(0, 50), 
            hasBody: !!body,
            html,
            type
        });

        // Validation
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            console.warn('⚠️ [MAIL] No recipients provided');
            return res.status(400).json({
                success: false,
                message: 'Recipients list is required'
            });
        }

        if (!subject || !subject.trim()) {
            console.warn('⚠️ [MAIL] No subject provided');
            return res.status(400).json({
                success: false,
                message: 'Subject is required'
            });
        }

        if (!body || !body.trim()) {
            console.warn('⚠️ [MAIL] No body provided');
            return res.status(400).json({
                success: false,
                message: 'Email body is required'
            });
        }

        // Promisify database get operation
        const dbGet = (query, params) => {
            return new Promise((resolve, reject) => {
                db.get(query, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };

        // Promisify database run operation
        const dbRun = (query, params) => {
            return new Promise((resolve, reject) => {
                db.run(query, params, function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        };

        // Check if user has admin privilege to send emails
        console.log('🔍 [MAIL] Checking user role for user ID:', req.user.id);
        const currentUser = await dbGet('SELECT role FROM users WHERE id = ?', [req.user.id]);
        
        if (!currentUser) {
            console.error('❌ [MAIL] User not found in database:', req.user.id);
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ [MAIL] User found with role:', currentUser.role);

        if (currentUser.role !== 'admin') {
            console.warn(`⚠️ [MAIL] Non-admin user ${req.user.id} attempted to send bulk email. Role: ${currentUser.role}`);
            return res.status(403).json({
                success: false,
                message: 'Only admins can send bulk emails'
            });
        }

        console.log('✅ [MAIL] Admin permission verified. Starting email send...');

        let successful = 0;
        let failed = 0;
        const failedRecipients = [];

        // Send emails to each recipient
        for (const recipientData of recipients) {
            try {
                // Handle both email string and user object
                const email = typeof recipientData === 'string' ? 
                    recipientData : 
                    recipientData.email;

                const name = typeof recipientData === 'string' ? 
                    'User' : 
                    (recipientData.name || 'User');

                console.log(`📧 [MAIL] Sending to ${email}...`);

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
                    console.log(`✅ [MAIL] Email sent to ${email}`);
                } else {
                    failed++;
                    failedRecipients.push({
                        email,
                        name,
                        reason: 'SMTP error'
                    });
                    console.log(`❌ [MAIL] Failed to send to ${email}`);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`❌ [MAIL] Error sending email to recipient:`, error.message);
                failed++;
                failedRecipients.push({
                    email: recipientData.email || recipientData,
                    name: recipientData.name || 'Unknown',
                    reason: error.message
                });
            }
        }

        console.log(`📊 [MAIL] Campaign completed: ${successful} sent, ${failed} failed`);

        // Log email sending activity
        try {
            await dbRun(
                `INSERT INTO activity_logs (user_id, action, details) 
                 VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    'SEND_BULK_EMAIL',
                    `Sent ${successful} emails, ${failed} failed. Type: ${type}`
                ]
            );
            console.log('✅ [MAIL] Activity logged');
        } catch (logErr) {
            console.warn('⚠️ [MAIL] Failed to log email activity:', logErr.message);
            // Don't fail the response if logging fails
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
    } catch (error) {
        console.error('❌ [MAIL] Error in send-bulk endpoint:', error.message);
        console.error('❌ [MAIL] Stack trace:', error.stack);
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
