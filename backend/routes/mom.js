import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { logActivity } from '../utils/logger.js';

import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } from 'docx';
import PDFDocument from 'pdfkit';

const router = express.Router();

const get = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Create MOM (admin only)
router.post('/create', authenticateToken, requireRole('admin'), [
  body('title').optional().trim(),
  body('date').notEmpty(),
  body('time').optional().trim(),
  body('venue').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, date, time, venue, attendance = [], points = [], status = 'draft' } = req.body;
    const db = getDatabase();

    const result = await run(db, `INSERT INTO mom_meetings (title, date, time, venue, organizer_id, status) VALUES (?, ?, ?, ?, ?, ?)`, [title || null, date, time || null, venue || null, req.user.id, status]);
    const momId = result.lastID;

    // Insert attendance rows
    let serial = 1;
    for (const a of attendance) {
      await run(db, `INSERT INTO mom_attendance (mom_id, user_id, serial, name, department, year) VALUES (?, ?, ?, ?, ?, ?)`, [momId, a.userId || null, serial++, a.name || null, a.department || null, a.year || null]);
    }

    // Insert points
    let pNo = 1;
    for (const p of points) {
      await run(db, `INSERT INTO mom_points (mom_id, point_no, title, discussion) VALUES (?, ?, ?, ?)`, [momId, pNo++, p.title || null, Array.isArray(p.discussion) ? JSON.stringify(p.discussion) : (p.discussion || null)]);
    }

    await logActivity(req.user.id, 'CREATE_MOM', { momId, title }, req, {
      action_type: 'CREATE', module_name: 'mom', action_description: `Created MOM: ${title}`, reference_id: momId
    });

    res.json({ success: true, message: 'MOM created', id: momId });
  } catch (error) {
    console.error('Create MOM error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get MOM
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const mom = await get(db, 'SELECT * FROM mom_meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ success: false, message: 'MOM not found' });

    const attendance = await all(db, 'SELECT * FROM mom_attendance WHERE mom_id = ? ORDER BY serial ASC', [req.params.id]);
    const points = await all(db, 'SELECT * FROM mom_points WHERE mom_id = ? ORDER BY point_no ASC', [req.params.id]);

    // Parse discussion JSON if stored as JSON
    const parsedPoints = points.map(p => ({ ...p, discussion: p.discussion && p.discussion.startsWith('[') ? JSON.parse(p.discussion) : p.discussion }));

    res.json({ success: true, mom, attendance, points: parsedPoints });
  } catch (error) {
    console.error('Get MOM error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update MOM (admin only)
router.put('/update/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const mom = await get(db, 'SELECT * FROM mom_meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ success: false, message: 'MOM not found' });

    const { title, date, time, venue, attendance = [], points = [], status } = req.body;
    const updates = [];
    const params = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (date !== undefined) { updates.push('date = ?'); params.push(date); }
    if (time !== undefined) { updates.push('time = ?'); params.push(time); }
    if (venue !== undefined) { updates.push('venue = ?'); params.push(venue); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (updates.length > 0) {
      params.push(req.params.id);
      await run(db, `UPDATE mom_meetings SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Replace attendance rows (simple approach)
    await run(db, 'DELETE FROM mom_attendance WHERE mom_id = ?', [req.params.id]);
    let serial = 1;
    for (const a of attendance) {
      await run(db, `INSERT INTO mom_attendance (mom_id, user_id, serial, name, department, year) VALUES (?, ?, ?, ?, ?, ?)`, [req.params.id, a.userId || null, serial++, a.name || null, a.department || null, a.year || null]);
    }

    // Replace points
    await run(db, 'DELETE FROM mom_points WHERE mom_id = ?', [req.params.id]);
    let pNo = 1;
    for (const p of points) {
      await run(db, `INSERT INTO mom_points (mom_id, point_no, title, discussion) VALUES (?, ?, ?, ?)`, [req.params.id, pNo++, p.title || null, Array.isArray(p.discussion) ? JSON.stringify(p.discussion) : (p.discussion || null)]);
    }

    await logActivity(req.user.id, 'UPDATE_MOM', { id: req.params.id }, req, { action_type: 'UPDATE', module_name: 'mom', action_description: `Updated MOM ${req.params.id}`, reference_id: req.params.id });

    res.json({ success: true, message: 'MOM updated' });
  } catch (error) {
    console.error('Update MOM error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete MOM (admin only)
router.delete('/delete/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const mom = await get(db, 'SELECT * FROM mom_meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ success: false, message: 'MOM not found' });

    await run(db, 'DELETE FROM mom_meetings WHERE id = ?', [req.params.id]);

    await logActivity(req.user.id, 'DELETE_MOM', { id: req.params.id }, req, { action_type: 'DELETE', module_name: 'mom', action_description: `Deleted MOM ${req.params.id}`, reference_id: req.params.id });

    res.json({ success: true, message: 'MOM deleted' });
  } catch (error) {
    console.error('Delete MOM error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper: load image buffer if exists
const loadImageBuffer = (filename) => {
  try {
    const root = path.resolve(process.cwd());
    const p = path.join(root, 'Images', filename);
    if (fs.existsSync(p)) return fs.readFileSync(p);
    // fallback to public images
    const pub = path.join(root, 'public', 'images', filename);
    if (fs.existsSync(pub)) return fs.readFileSync(pub);
  } catch (e) {
    // ignore
  }
  return null;
};

// Download DOCX
router.get('/download/docx/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const mom = await get(db, 'SELECT * FROM mom_meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ success: false, message: 'MOM not found' });

    const attendance = await all(db, 'SELECT * FROM mom_attendance WHERE mom_id = ? ORDER BY serial ASC', [req.params.id]);
    const points = await all(db, 'SELECT * FROM mom_points WHERE mom_id = ? ORDER BY point_no ASC', [req.params.id]);

    // Build docx
    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: 'NormalText',
            name: 'Normal Text',
            run: { font: 'Times New Roman', size: 24 }
          }
        ]
      }
    });

    const runs = [];

    // Header: logos and center title
    const smLogoBuf = loadImageBuffer('Picsart_23-05-18_16-47-20-287-removebg-preview.png');
    const ksrctLogoBuf = loadImageBuffer('Brand_logo.png');

    const headerChildren = [];

    // Left logo
    if (smLogoBuf) {
      headerChildren.push(new Paragraph({ children: [ new ImageRun({ data: smLogoBuf, transformation: { width: 60, height: 60 } }) ], alignment: AlignmentType.LEFT }));
    }

    // Center title block
    headerChildren.push(new Paragraph({ children: [ new TextRun({ text: 'K.S. RANGASAMY COLLEGE OF TECHNOLOGY, TIRUCHENGODE – 637215', bold: true, size: 28, font: 'Times New Roman' }) ], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [ new TextRun({ text: 'Service Motto Volunteering Forum', italics: false, size: 26, font: 'Times New Roman' }) ], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [ new TextRun({ text: 'REGULAR MEETING', bold: true, size: 26, font: 'Times New Roman' }) ], alignment: AlignmentType.CENTER }));

    // Date/Time/Venue
    headerChildren.push(new Paragraph({ children: [ new TextRun({ text: `Date: ${mom.date || ''}`, size: 24, font: 'Times New Roman' }) ], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [ new TextRun({ text: `Time: ${mom.time || ''}`, size: 24, font: 'Times New Roman' }) ], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [ new TextRun({ text: `Venue: ${mom.venue || ''}`, size: 24, font: 'Times New Roman' }) ], alignment: AlignmentType.CENTER }));

    // Add header children
    headerChildren.forEach(h => doc.addSection({ children: [h] }));

    // Attendance table
    const tableRows = [];
    // header row
    tableRows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Name', bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: 'Department', bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: 'Year', bold: true })] }),
      ],
    }));

    attendance.forEach(a => {
      tableRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(`${a.serial}. ${a.name || ''}`)] }),
          new TableCell({ children: [new Paragraph(a.department || '')] }),
          new TableCell({ children: [new Paragraph(a.year || '')] }),
        ],
      }));
    });

    const attendanceTable = new Table({
      rows: tableRows,
      width: { size: 100, type: 0 }, // percent
    });

    doc.addSection({ children: [
      new Paragraph({ children: [ new TextRun({ text: 'ATTENDANCE', bold: true, size: 26, font: 'Times New Roman' }) ], alignment: AlignmentType.LEFT }),
      attendanceTable
    ] });

    // Minutes / Points
    const pointsChildren = [];
    pointsChildren.push(new Paragraph({ children: [ new TextRun({ text: 'MINUTES', bold: true, size: 26, font: 'Times New Roman' }) ], alignment: AlignmentType.LEFT }));

    for (const p of points) {
      pointsChildren.push(new Paragraph({ children: [ new TextRun({ text: `Point : ${p.point_no}`, bold: true, size: 24, font: 'Times New Roman' }) ] }));
      if (p.title) pointsChildren.push(new Paragraph({ children: [ new TextRun({ text: p.title, bold: true, size: 22, font: 'Times New Roman' }) ] }));
      // discussion could be JSON array
      let discussion = p.discussion;
      if (discussion && typeof discussion === 'string' && discussion.startsWith('[')) {
        try { discussion = JSON.parse(discussion); } catch(e) { }
      }
      if (Array.isArray(discussion)) {
        for (const d of discussion) {
          pointsChildren.push(new Paragraph({ children: [ new TextRun({ text: `• ${d}`, size: 22, font: 'Times New Roman' }) ] }));
        }
      } else if (discussion) {
        pointsChildren.push(new Paragraph({ children: [ new TextRun({ text: discussion, size: 22, font: 'Times New Roman' }) ] }));
      }
    }

    pointsChildren.forEach(c => doc.addSection({ children: [c] }));

    // Footer: Convener - Principal
    const footer = new Paragraph({ children: [ new TextRun({ text: '\n\nCONVENER', bold: true, size: 22, font: 'Times New Roman' }), new TextRun({ text: '                                    ' }), new TextRun({ text: 'PRINCIPAL', bold: true, size: 22, font: 'Times New Roman' }) ], alignment: AlignmentType.CENTER });
    doc.addSection({ children: [footer] });

    const packer = new Packer();
    const buffer = await packer.toBuffer(doc);

    res.setHeader('Content-Disposition', `attachment; filename=MOM-${req.params.id}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);

  } catch (error) {
    console.error('DOCX generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate DOCX' });
  }
});

// Download PDF
router.get('/download/pdf/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const mom = await get(db, 'SELECT * FROM mom_meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ success: false, message: 'MOM not found' });

    const attendance = await all(db, 'SELECT * FROM mom_attendance WHERE mom_id = ? ORDER BY serial ASC', [req.params.id]);
    const points = await all(db, 'SELECT * FROM mom_points WHERE mom_id = ? ORDER BY point_no ASC', [req.params.id]);

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Disposition', `attachment; filename=MOM-${req.params.id}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);

    const smLogoBuf = loadImageBuffer('Picsart_23-05-18_16-47-20-287-removebg-preview.png');
    const ksrctLogoBuf = loadImageBuffer('Brand_logo.png');

    // Header with logos
    if (smLogoBuf) {
      doc.image(smLogoBuf, 50, 40, { width: 60 });
    }
    if (ksrctLogoBuf) {
      doc.image(ksrctLogoBuf, 480, 40, { width: 60 });
    }

    doc.font('Times-Roman').fontSize(14).text('K.S. RANGASAMY COLLEGE OF TECHNOLOGY, TIRUCHENGODE – 637215', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(12).text('Service Motto Volunteering Forum', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(12).text('REGULAR MEETING', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(10).text(`Date: ${mom.date || ''}`, { align: 'center' });
    doc.text(`Time: ${mom.time || ''}`, { align: 'center' });
    doc.text(`Venue: ${mom.venue || ''}`, { align: 'center' });

    doc.moveDown(1);
    doc.fontSize(12).text('ATTENDANCE', { underline: true });
    doc.moveDown(0.5);

    // simple table-like layout: Name | Department | Year
    const tableHeader = ['Name', 'Department', 'Year'];
    const colWidths = [200, 150, 100];
    // header
    tableHeader.forEach((h, i) => {
      doc.font('Times-Bold').fontSize(10).text(h, { continued: i < tableHeader.length - 1, width: colWidths[i] });
    });
    doc.moveDown(0.2);
    doc.font('Times-Roman');

    attendance.forEach(a => {
      doc.fontSize(10).text(`${a.serial}. ${a.name || ''}`, { continued: true, width: colWidths[0] });
      doc.text(a.department || '', { continued: true, width: colWidths[1] });
      doc.text(a.year || '', { width: colWidths[2] });
    });

    doc.moveDown(0.5);
    doc.fontSize(12).text('MINUTES', { underline: true });
    doc.moveDown(0.5);

    // Discussion points table
    const pointTableHeader = ['Point', 'Topic', 'Discussion'];
    const pointColWidths = [50, 150, 280];
    
    // Table header
    pointTableHeader.forEach((h, i) => {
      doc.font('Times-Bold').fontSize(9).text(h, { continued: i < pointTableHeader.length - 1, width: pointColWidths[i] });
    });
    doc.moveDown(0.15);
    doc.strokeColor('#cccccc').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.2);
    doc.font('Times-Roman');

    for (const p of points) {
      let discussion = p.discussion;
      if (discussion && typeof discussion === 'string' && discussion.startsWith('[')) {
        try { discussion = JSON.parse(discussion); } catch(e) { }
      }
      
      let discussionText = '';
      if (Array.isArray(discussion)) {
        discussionText = discussion.join(' • ');
      } else if (discussion) {
        discussionText = discussion;
      }

      doc.fontSize(9).text(`${p.point_no}`, { continued: true, width: pointColWidths[0] });
      doc.text(p.title || '', { continued: true, width: pointColWidths[1] });
      doc.text(discussionText || '', { width: pointColWidths[2] });
      doc.moveDown(0.1);
    }
    
    doc.moveDown(0.3);

    // Footer
    doc.moveDown(2);
    const convenerX = 80;
    const principalX = 360;
    doc.fontSize(11).text('CONVENER', convenerX);
    doc.fontSize(11).text('PRINCIPAL', principalX);

    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

// Download logos
router.get('/download/sm-logo', (req, res) => {
  const root = path.resolve(process.cwd());
  const p = path.join(root, 'Images', 'Picsart_23-05-18_16-47-20-287-removebg-preview.png');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).json({ success: false, message: 'SM logo not found' });
});

router.get('/download/ksrct-logo', (req, res) => {
  const root = path.resolve(process.cwd());
  const p = path.join(root, 'Images', 'Brand_logo.png');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).json({ success: false, message: 'KSRCT logo not found' });
});

export default router;
