import express from 'express';
import { getDatabase } from '../database/init.js';
import { sendEmail } from '../utils/email.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/mail/health
 */
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'Mail service is running', timestamp: new Date().toISOString() });
});

/**
 * GET /api/mail/users
 * Returns INTERVIEW CANDIDATES (not system users) for the email recipient selector.
 * These are the people we send congratulations / selection result emails to.
 */
router.get('/users', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        db.all(
            `SELECT id, name, email, decision, status
             FROM interview_candidates
             WHERE email IS NOT NULL AND email != ''
             ORDER BY name ASC`,
            [],
            (err, candidates) => {
                if (err) {
                    console.error('Error fetching candidates:', err);
                    return res.status(500).json({ success: false, message: 'Failed to fetch candidates' });
                }
                res.json({
                    success: true,
                    users: (candidates || []).map(c => ({
                        id: c.id,
                        name: c.name,
                        email: c.email,
                        role: c.decision || 'candidate',
                        status: c.status
                    })),
                    total: candidates?.length || 0
                });
            }
        );
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch candidates' });
    }
});

/**
 * POST /api/mail/send-bulk
 * Send bulk emails with [Name] / [NAME] personalization per recipient.
 */
router.post('/send-bulk', authenticateToken, async (req, res) => {
    console.log('📧 [MAIL] send-bulk endpoint called');

    try {
        const db = getDatabase();
        const { recipients, subject, body, html = false, type = 'other' } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0)
            return res.status(400).json({ success: false, message: 'Recipients list is required' });
        if (!subject?.trim())
            return res.status(400).json({ success: false, message: 'Subject is required' });
        if (!body?.trim())
            return res.status(400).json({ success: false, message: 'Email body is required' });

        const dbGet = (q, p) => new Promise((resolve, reject) => db.get(q, p, (e, r) => e ? reject(e) : resolve(r)));
        const dbRun = (q, p) => new Promise((resolve, reject) => db.run(q, p, function (e) { e ? reject(e) : resolve(this.lastID); }));

        const currentUser = await dbGet('SELECT role FROM users WHERE id = ?', [req.user.id]);
        if (!currentUser) return res.status(401).json({ success: false, message: 'User not found' });
        if (currentUser.role !== 'admin') return res.status(403).json({ success: false, message: 'Only admins can send bulk emails' });

        let successful = 0, failed = 0;
        const failedRecipients = [];

        for (const recipientData of recipients) {
            try {
                const email = typeof recipientData === 'string' ? recipientData : recipientData.email;
                const name = typeof recipientData === 'string' ? 'User' : (recipientData.name || 'User');

                // Personalize body and subject — supports [Name], [NAME], {name}, {{name}}
                const personalize = (text) => text
                    .replace(/\[Name\]/g, name)
                    .replace(/\[name\]/g, name)
                    .replace(/\{name\}/g, name)
                    .replace(/{{name}}/g, name)
                    .replace(/\[NAME\]/g, name.toUpperCase())
                    .replace(/{{NAME}}/g, name.toUpperCase());

                const emailContent = html ? personalize(body) : `<p>${personalize(body).replace(/\n/g, '</p><p>')}</p>`;
                const emailSubject = personalize(subject);

                const success = await sendEmail(email, emailSubject, emailContent);
                if (success) { successful++; console.log(`✅ [MAIL] Sent to ${email}`); }
                else { failed++; failedRecipients.push({ email, name, reason: 'SMTP error' }); }

                await new Promise(r => setTimeout(r, 500)); // rate-limit buffer

            } catch (err) {
                failed++;
                failedRecipients.push({ email: recipientData.email || recipientData, name: recipientData.name || 'Unknown', reason: err.message });
            }
        }

        try {
            await dbRun(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [req.user.id, 'SEND_BULK_EMAIL', `Sent ${successful} emails, ${failed} failed. Type: ${type}`]);
        } catch (logErr) { /* non-critical */ }

        res.json({
            success: true,
            message: `Email campaign completed. Sent: ${successful}, Failed: ${failed}`,
            stats: { successful, failed, total: recipients.length, failedRecipients: failed > 0 ? failedRecipients : [] }
        });
    } catch (error) {
        console.error('❌ [MAIL] Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send bulk emails', error: error.message });
    }
});

/**
 * GET /api/mail/templates
 * Rich congratulations HTML templates matching the Python email script design.
 * Uses [Name] / [NAME] placeholders for personalization.
 */
router.get('/templates', authenticateToken, (req, res) => {

    const buildHtml = (roleLabel) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Congratulations – SM Volunteers</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
<tr><td align="center">

  <table width="100%" cellpadding="0" cellspacing="0"
    style="max-width:600px;background:#420000;border:2px solid #ffd700;border-radius:15px;box-shadow:0 10px 25px rgba(0,0,0,0.5);color:#ffffff;">

    <tr><td>
      <div style="height:3px;background:linear-gradient(90deg,#b8860b,#ffd700,#b8860b);border-radius:15px 15px 0 0;"></div>
    </td></tr>

    <tr><td style="padding:35px 40px 20px 40px;text-align:center;">
      <h1 style="font-family:'Times New Roman',Times,serif;color:#ffffff;font-size:36px;margin:0 0 8px 0;font-style:italic;font-weight:normal;">
        Congratulations
      </h1>
      <p style="margin:0 0 4px 0;font-size:12px;color:#ffc107;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
        WELCOME TO OUR
      </p>
      <h2 style="margin:0 0 25px 0;font-size:17px;color:#ffd700;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
        SM VOLUNTEERS FORUM AS ${roleLabel}
      </h2>

      <!-- Gold name banner -->
      <div style="border:2px solid #ffd700;padding:14px 10px;margin:0 auto 25px auto;width:78%;border-radius:8px;box-shadow:0 0 15px rgba(255,215,0,0.15);">
        <span style="font-family:'Arial Black','Arial Bold',sans-serif;font-size:26px;color:#ffd700;text-transform:uppercase;letter-spacing:2px;font-weight:900;">
          [NAME]
        </span>
      </div>
    </td></tr>

    <tr><td style="padding:0 40px 35px 40px;color:#e0e0e0;font-size:15px;line-height:1.75;">
      <p>Dear <strong style="color:#fff;">[Name]</strong>,</p>

      <p><strong style="color:#ffd700;">Congratulations! 🎉</strong><br>
      You have <strong>successfully cleared the SM interview</strong> and have been selected as
      <strong>${roleLabel}</strong> of the <strong>SM Volunteers Forum</strong>.</p>

      <p>Your dedication, confidence, and hard work truly stood out during the selection process.
      We look forward to your valuable contributions and leadership.</p>

      <!-- Welcome highlight -->
      <div style="margin:22px 0;padding:16px;background:linear-gradient(135deg,rgba(255,215,0,0.06),rgba(255,215,0,0.13));border:1px solid rgba(255,215,0,0.3);border-radius:10px;text-align:center;color:#ffd700;font-weight:bold;font-size:15px;">
        ✨ Welcome to the SM Family ✨
      </div>

      <p style="font-weight:bold;color:#fff;margin-bottom:6px;">📲 Join the Official SM WhatsApp Group</p>
      <p style="font-size:13px;margin-top:0;">All upcoming information and announcements will be shared
      <strong>only via the official WhatsApp group</strong>. Joining is <strong>mandatory</strong>.</p>

      <div style="text-align:center;margin:26px 0;">
        <a href="https://chat.whatsapp.com/CJeFwL5abHc8VkqeAa3n1v"
           style="background:linear-gradient(135deg,#25D366,#1ebe5d);color:#ffffff;padding:14px 36px;text-decoration:none;font-size:15px;font-weight:bold;border-radius:50px;display:inline-block;">
          🚀 Join WhatsApp Group
        </a>
      </div>

      <p style="margin-top:28px;font-style:italic;color:#ccc;">
        Achievements are earned through dedication and hard work.<br>
        <strong style="color:#fff;">Congratulations on this proud milestone!</strong>
      </p>

      <p style="margin-top:18px;color:#fff;">Warm regards,<br><strong>SM Team</strong></p>
    </td></tr>

    <tr><td style="padding:0 40px 18px 40px;">
      <div style="height:2px;background:linear-gradient(90deg,#b8860b,#ffd700,#b8860b);border-radius:0 0 15px 15px;"></div>
      <p style="text-align:center;font-size:11px;color:#888;margin:10px 0 0 0;">KSRCT SM Volunteers</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

    res.json({
        success: true,
        templates: {
            volunteer: {
                name: 'Volunteer',
                subject: 'Congratulations [Name]! – SM Volunteers',
                html: buildHtml('VOLUNTEER')
            },
            office_bearer: {
                name: 'Office Bearer',
                subject: 'Congratulations [Name]! – SM Volunteers',
                html: buildHtml('OFFICE BEARER')
            }
        }
    });
});

export default router;
