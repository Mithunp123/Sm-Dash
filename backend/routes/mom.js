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
    console.log(`👥 Inserting ${attendance.length} attendance entries for MOM ${momId}`);
    for (const a of attendance) {
      if (!a.userId && !a.name) continue; // Skip empty rows
      await run(db, `INSERT INTO mom_attendance (mom_id, user_id, serial, name, department, year) VALUES (?, ?, ?, ?, ?, ?)`, [momId, a.userId || null, serial++, a.name || null, a.department || null, a.year || null]);
      console.log(`✅ Attendance ${serial - 1}: ${a.name || 'User ' + a.userId}`);
    }
    console.log(`✅ Total ${serial - 1} attendance rows inserted`);

    // Insert points
    let pNo = 1;
    console.log(`📝 Inserting ${points.length} discussion points for MOM ${momId}`);
    for (const p of points) {
      if (!p.title && (!p.discussion || (Array.isArray(p.discussion) && p.discussion.length === 0))) continue; // Skip empty points
      await run(db, `INSERT INTO mom_points (mom_id, point_no, title, discussion) VALUES (?, ?, ?, ?)`, [momId, pNo++, p.title || null, Array.isArray(p.discussion) ? JSON.stringify(p.discussion) : (p.discussion || null)]);
      console.log(`✅ Point ${pNo - 1}: \"${p.title}\"`);
    }
    console.log(`✅ Total ${pNo - 1} points inserted`);

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

    // Replace attendance rows
    await run(db, 'DELETE FROM mom_attendance WHERE mom_id = ?', [req.params.id]);
    let serial = 1;
    console.log(`👥 Updating ${attendance.length} attendance entries for MOM ${req.params.id}`);
    for (const a of attendance) {
      if (!a.userId && !a.name) continue; // Skip empty rows
      await run(db, `INSERT INTO mom_attendance (mom_id, user_id, serial, name, department, year) VALUES (?, ?, ?, ?, ?, ?)`, [req.params.id, a.userId || null, serial++, a.name || null, a.department || null, a.year || null]);
      console.log(`✅ Attendance ${serial - 1}: ${a.name || 'User ' + a.userId}`);
    }
    console.log(`✅ Total ${serial - 1} attendance rows updated`);

    // Replace points
    await run(db, 'DELETE FROM mom_points WHERE mom_id = ?', [req.params.id]);
    let pNo = 1;
    console.log(`📝 Updating ${points.length} discussion points for MOM ${req.params.id}`);
    for (const p of points) {
      if (!p.title && (!p.discussion || (Array.isArray(p.discussion) && p.discussion.length === 0))) continue; // Skip empty points
      await run(db, `INSERT INTO mom_points (mom_id, point_no, title, discussion) VALUES (?, ?, ?, ?)`, [req.params.id, pNo++, p.title || null, Array.isArray(p.discussion) ? JSON.stringify(p.discussion) : (p.discussion || null)]);
      console.log(`✅ Point ${pNo - 1}: \"${p.title}\"`);
    }
    console.log(`✅ Total ${pNo - 1} points updated`);

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
      headerChildren.push(new Paragraph({ children: [new ImageRun({ data: smLogoBuf, transformation: { width: 60, height: 60 } })], alignment: AlignmentType.LEFT }));
    }

    // Center title block
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: 'K.S. RANGASAMY COLLEGE OF TECHNOLOGY, TIRUCHENGODE – 637215', bold: true, size: 28, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: 'Service Motto Volunteering Forum', italics: false, size: 26, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: 'REGULAR MEETING', bold: true, size: 26, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }));

    // Date/Time/Venue
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: `Date: ${mom.date || ''}`, size: 24, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: `Time: ${mom.time || ''}`, size: 24, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }));
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: `Venue: ${mom.venue || ''}`, size: 24, font: 'Times New Roman' })], alignment: AlignmentType.CENTER }));

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

    doc.addSection({
      children: [
        new Paragraph({ children: [new TextRun({ text: 'ATTENDANCE', bold: true, size: 26, font: 'Times New Roman' })], alignment: AlignmentType.LEFT }),
        attendanceTable
      ]
    });

    // Minutes / Points
    const pointsChildren = [];
    pointsChildren.push(new Paragraph({ children: [new TextRun({ text: 'MINUTES', bold: true, size: 26, font: 'Times New Roman' })], alignment: AlignmentType.LEFT }));

    for (const p of points) {
      pointsChildren.push(new Paragraph({ children: [new TextRun({ text: `Point : ${p.point_no}`, bold: true, size: 24, font: 'Times New Roman' })] }));
      if (p.title) pointsChildren.push(new Paragraph({ children: [new TextRun({ text: p.title, bold: true, size: 22, font: 'Times New Roman' })] }));
      // discussion could be JSON array
      let discussion = p.discussion;
      if (discussion && typeof discussion === 'string' && discussion.startsWith('[')) {
        try { discussion = JSON.parse(discussion); } catch (e) { }
      }
      if (Array.isArray(discussion)) {
        for (const d of discussion) {
          pointsChildren.push(new Paragraph({ children: [new TextRun({ text: `• ${d}`, size: 22, font: 'Times New Roman' })] }));
        }
      } else if (discussion) {
        pointsChildren.push(new Paragraph({ children: [new TextRun({ text: discussion, size: 22, font: 'Times New Roman' })] }));
      }
    }

    pointsChildren.forEach(c => doc.addSection({ children: [c] }));

    // Footer: Convener - Principal
    const footer = new Paragraph({ children: [new TextRun({ text: '\n\nCONVENER', bold: true, size: 22, font: 'Times New Roman' }), new TextRun({ text: '                                    ' }), new TextRun({ text: 'PRINCIPAL', bold: true, size: 22, font: 'Times New Roman' })], alignment: AlignmentType.CENTER });
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

    // ── PDF setup ────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    res.setHeader('Content-Disposition', `attachment; filename=${new Date().toLocaleDateString('en-GB').replace(/\//g, '') + '-SM-MOM.pdf'}`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const PAGE_LEFT = 50;
    const PAGE_RIGHT = 545;  // 595 - 50
    const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT; // 495

    // ── Helper: draw a horizontal rule ───────────────────────────────────────
    const hRule = (y, color = '#000000', thickness = 0.5) => {
      doc.save()
        .strokeColor(color)
        .lineWidth(thickness)
        .moveTo(PAGE_LEFT, y)
        .lineTo(PAGE_RIGHT, y)
        .stroke()
        .restore();
    };

    // ── Load images ──────────────────────────────────────────────────────────
    const smLogoBuf = loadImageBuffer('Picsart_23-05-18_16-47-20-287-removebg-preview.png');
    const ksrctLogoBuf = loadImageBuffer('Brand_logo.png');

    // ── HEADER ───────────────────────────────────────────────────────────────
    const LOGO_SIZE = 65;
    const LOGO_TOP = 40;

    if (smLogoBuf) doc.image(smLogoBuf, PAGE_LEFT, LOGO_TOP, { width: LOGO_SIZE, height: LOGO_SIZE });
    if (ksrctLogoBuf) doc.image(ksrctLogoBuf, PAGE_RIGHT - LOGO_SIZE, LOGO_TOP, { width: LOGO_SIZE, height: LOGO_SIZE });

    // Center text block starts aligned with top of logos
    const TEXT_START_Y = LOGO_TOP;
    const CENTER_X = PAGE_LEFT + LOGO_SIZE + 10;
    const CENTER_W = PAGE_WIDTH - (LOGO_SIZE + 10) * 2;

    doc.font('Times-Bold')
      .fontSize(13)
      .text('K.S. RANGASAMY COLLEGE OF TECHNOLOGY, TIRUCHENGODE \u2013 637215',
        CENTER_X, TEXT_START_Y, { width: CENTER_W, align: 'center' });

    doc.font('Times-Roman')
      .fontSize(11)
      .text('Service Motto Volunteering Forum',
        CENTER_X, doc.y + 2, { width: CENTER_W, align: 'center' });

    doc.font('Times-Bold')
      .fontSize(12)
      .text('REGULAR MEETING',
        CENTER_X, doc.y + 2, { width: CENTER_W, align: 'center' });

    // ensure we clear the logos
    if (doc.y < LOGO_TOP + LOGO_SIZE + 5) doc.y = LOGO_TOP + LOGO_SIZE + 5;

    // Date / Time / Venue centered across full width
    const formatDate = (raw) => {
      if (!raw) return '';
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    doc.moveDown(0.4);
    doc.font('Times-Roman').fontSize(11)
      .text(`Date: ${formatDate(mom.date)}`, PAGE_LEFT, doc.y, { width: PAGE_WIDTH, align: 'center' });
    doc.fontSize(11)
      .text(`Time: ${mom.time || ''}`, PAGE_LEFT, doc.y + 2, { width: PAGE_WIDTH, align: 'center' });
    doc.fontSize(11)
      .text(`Venue: ${mom.venue || ''}`, PAGE_LEFT, doc.y + 2, { width: PAGE_WIDTH, align: 'center' });

    doc.moveDown(0.8);
    hRule(doc.y);
    doc.moveDown(0.6);

    // ── ATTENDANCE ───────────────────────────────────────────────────────────
    doc.font('Times-Bold').fontSize(12)
      .text('ATTENDANCE', PAGE_LEFT, doc.y, { underline: true });
    doc.moveDown(0.4);

    // Table geometry
    const COL = {
      sno: { x: PAGE_LEFT, w: 35 },
      name: { x: PAGE_LEFT + 35, w: 200 },
      dept: { x: PAGE_LEFT + 235, w: 165 },
      year: { x: PAGE_LEFT + 400, w: 95 }
    };
    const TABLE_RIGHT = PAGE_LEFT + 495;
    const ROW_H = 18;
    const CELL_PAD = 4;
    const PAGE_BOTTOM = 750; // Auto page break threshold

    // Helper: Abbreviate department names for display
    const abbreviateDept = (dept) => {
      if (!dept) return '';
      const abbrev = {
        'Artificial Intelligence and Data Science': 'AI & DS',
        'Artificial Intelligence and Machine Learning': 'AI & ML',
        'Computer Science and Engineering': 'CSE',
        'Electronics and Communication Engineering': 'ECE',
        'Electrical and Electronics Engineering': 'EEE',
        'Mechanical Engineering': 'ME',
        'Mechatronics Engineering': 'Mechatronics',
        'Food Technology': 'FT',
        'Information Technology': 'IT',
        'Textile Technology': 'Textile',
        'Very Large Scale Integration Technology': 'VLSI',
        'Computer Science and Business Systems': 'CSBS',
        'Master of Business Administration': 'MBA',
        'Master of Computer Applications': 'MCA',
        'Civil Engineering': 'Civil',
        'Biotechnology': 'Biotech'
      };
      return abbrev[dept] || dept.substring(0, 20) + (dept.length > 20 ? '...' : '');
    };

    // draw table outer border + header row
    const drawTableHeader = (y) => {
      // outer box for header
      doc.rect(COL.sno.x, y, TABLE_RIGHT - COL.sno.x, ROW_H).fillAndStroke('#e8e8e8', '#000000');
      // vertical dividers in header
      [COL.name.x, COL.dept.x, COL.year.x].forEach(x => {
        doc.save().strokeColor('#000000').lineWidth(0.5)
          .moveTo(x, y).lineTo(x, y + ROW_H).stroke().restore();
      });
      // header text
      doc.fillColor('#000000').font('Times-Bold').fontSize(9);
      doc.text('S.No', COL.sno.x + CELL_PAD, y + CELL_PAD, { width: COL.sno.w - CELL_PAD, lineBreak: false });
      doc.text('Name', COL.name.x + CELL_PAD, y + CELL_PAD, { width: COL.name.w - CELL_PAD, lineBreak: false });
      doc.text('Dept', COL.dept.x + CELL_PAD, y + CELL_PAD, { width: COL.dept.w - CELL_PAD, lineBreak: false });
      doc.text('Year', COL.year.x + CELL_PAD, y + CELL_PAD, { width: COL.year.w - CELL_PAD, lineBreak: false });
    };

    let tableY = doc.y;
    drawTableHeader(tableY);
    tableY += ROW_H;

    doc.font('Times-Roman').fontSize(9).fillColor('#000000');

    attendance.forEach((a, idx) => {
      // Auto page break with header continuation
      if (tableY + ROW_H > PAGE_BOTTOM) {
        doc.addPage();
        tableY = PAGE_LEFT + 50; // top margin on new page
        drawTableHeader(tableY);
        tableY += ROW_H;
      }

      const rowColor = idx % 2 === 0 ? '#ffffff' : '#f5f5f5';
      doc.rect(COL.sno.x, tableY, TABLE_RIGHT - COL.sno.x, ROW_H)
        .fillAndStroke(rowColor, '#000000');
      // dividers
      [COL.name.x, COL.dept.x, COL.year.x].forEach(x => {
        doc.save().strokeColor('#000000').lineWidth(0.5)
          .moveTo(x, tableY).lineTo(x, tableY + ROW_H).stroke().restore();
      });
      doc.fillColor('#000000');
      doc.text(String(a.serial || idx + 1), COL.sno.x + CELL_PAD, tableY + CELL_PAD, { width: COL.sno.w - CELL_PAD, lineBreak: false });
      doc.text(a.name || '', COL.name.x + CELL_PAD, tableY + CELL_PAD, { width: COL.name.w - CELL_PAD, lineBreak: false });
      doc.text(abbreviateDept(a.department), COL.dept.x + CELL_PAD, tableY + CELL_PAD, { width: COL.dept.w - CELL_PAD, lineBreak: false });
      doc.text(a.year || '', COL.year.x + CELL_PAD, tableY + CELL_PAD, { width: COL.year.w - CELL_PAD, lineBreak: false });
      tableY += ROW_H;
    });

    // move cursor below table so minutes starts on fresh line
    tableY += 12;
    if (tableY > PAGE_BOTTOM - 100) {
      doc.addPage();
      tableY = PAGE_LEFT + 50; // top margin on new page
    }

    hRule(tableY - 12);
    doc.y = tableY;
    doc.moveDown(0.6);

    // ── MINUTES ──────────────────────────────────────────────────────────────
    doc.font('Times-Bold').fontSize(12)
      .text('MINUTES', PAGE_LEFT, doc.y, { underline: true });
    doc.moveDown(0.4);

    // Minutes table geometry
    const MCOL = {
      sno: { x: PAGE_LEFT, w: 40 },
      topic: { x: PAGE_LEFT + 40, w: 155 },
      disc: { x: PAGE_LEFT + 195, w: 300 }
    };
    const MTABLE_RIGHT = PAGE_LEFT + 495;
    const MCELL_PAD = 4;

    // Draw minutes table header helper
    const drawMinutesTableHeader = (y) => {
      doc.rect(MCOL.sno.x, y, MTABLE_RIGHT - MCOL.sno.x, ROW_H)
        .fillAndStroke('#e8e8e8', '#000000');
      [MCOL.topic.x, MCOL.disc.x].forEach(x => {
        doc.save().strokeColor('#000000').lineWidth(0.5)
          .moveTo(x, y).lineTo(x, y + ROW_H).stroke().restore();
      });
      doc.fillColor('#000000').font('Times-Bold').fontSize(9);
      doc.text('No.', MCOL.sno.x + MCELL_PAD, y + CELL_PAD,
        { width: MCOL.sno.w - MCELL_PAD, lineBreak: false });
      doc.text('Topic', MCOL.topic.x + MCELL_PAD, y + CELL_PAD,
        { width: MCOL.topic.w - MCELL_PAD, lineBreak: false });
      doc.text('Discussion', MCOL.disc.x + MCELL_PAD, y + CELL_PAD,
        { width: MCOL.disc.w - MCELL_PAD, lineBreak: false });
    };

    let mTableY = doc.y;
    drawMinutesTableHeader(mTableY);
    mTableY += ROW_H;

    for (let pi = 0; pi < points.length; pi++) {
      const p = points[pi];
      let discussion = p.discussion;
      if (discussion && typeof discussion === 'string' && discussion.startsWith('[')) {
        try { discussion = JSON.parse(discussion); } catch (e) { /* keep as string */ }
      }

      // Build discussion lines array
      const discLines = [];
      if (Array.isArray(discussion)) {
        discussion.forEach(line => { if (String(line).trim()) discLines.push(String(line).trim()); });
      } else if (typeof discussion === 'string' && discussion.trim()) {
        discLines.push(discussion.trim());
      }

      // Calculate row height based on content
      // Estimate lines needed for topic and discussion text
      const FONT_SIZE = 9;
      const LEADING = FONT_SIZE * 1.4;
      const topicLines = p.title ? Math.ceil(doc.widthOfString(p.title, { font: 'Times-Roman', fontSize: FONT_SIZE }) / (MCOL.topic.w - MCELL_PAD * 2)) : 1;
      const discTextLines = discLines.reduce((acc, line) => {
        return acc + Math.max(1, Math.ceil(doc.widthOfString('\u2022 ' + line, { font: 'Times-Roman', fontSize: FONT_SIZE }) / (MCOL.disc.w - MCELL_PAD * 2)));
      }, 0) || 1;
      const contentLines = Math.max(topicLines, discTextLines);
      const dynRowH = Math.max(ROW_H, contentLines * LEADING + MCELL_PAD * 2);

      // Auto page break with header continuation
      if (mTableY + dynRowH > PAGE_BOTTOM) {
        doc.addPage();
        mTableY = PAGE_LEFT + 50; // top margin on new page
        drawMinutesTableHeader(mTableY);
        mTableY += ROW_H;
      }

      const rowColor = pi % 2 === 0 ? '#ffffff' : '#f5f5f5';
      doc.rect(MCOL.sno.x, mTableY, MTABLE_RIGHT - MCOL.sno.x, dynRowH)
        .fillAndStroke(rowColor, '#000000');
      [MCOL.topic.x, MCOL.disc.x].forEach(x => {
        doc.save().strokeColor('#000000').lineWidth(0.5)
          .moveTo(x, mTableY).lineTo(x, mTableY + dynRowH).stroke().restore();
      });

      doc.fillColor('#000000').font('Times-Roman').fontSize(FONT_SIZE);
      doc.text(String(p.point_no), MCOL.sno.x + MCELL_PAD, mTableY + MCELL_PAD,
        { width: MCOL.sno.w - MCELL_PAD, lineBreak: false });
      doc.text(p.title || '', MCOL.topic.x + MCELL_PAD, mTableY + MCELL_PAD,
        { width: MCOL.topic.w - MCELL_PAD * 2, lineBreak: true });

      // Discussion cell — bullet per line
      let discY = mTableY + MCELL_PAD;
      if (discLines.length > 0) {
        discLines.forEach(line => {
          doc.text(`\u2022 ${line}`, MCOL.disc.x + MCELL_PAD, discY,
            { width: MCOL.disc.w - MCELL_PAD * 2, lineBreak: true });
          discY = doc.y;
        });
      } else {
        doc.text('', MCOL.disc.x + MCELL_PAD, discY, { lineBreak: false });
      }

      mTableY += dynRowH;
    }

    // ── FOOTER: Convener & Principal ─────────────────────────────────────────
    // Add space and footer on the last page
    doc.moveDown(1);
    
    const currentPage = doc.bufferedPageRange().count;
    const footerAreaY = Math.min(doc.y + 40, 750); // Safe footer positioning
    
    // Draw separator line above footer
    doc.save()
      .strokeColor('#000000')
      .lineWidth(0.5)
      .moveTo(PAGE_LEFT, footerAreaY - 15)
      .lineTo(PAGE_RIGHT, footerAreaY - 15)
      .stroke()
      .restore();

    // Place CONVENER on the left, PRINCIPAL on the right at the same y
    doc.font('Times-Bold').fontSize(11)
      .text('CONVENER', PAGE_LEFT + 20, footerAreaY, { width: 160, align: 'center', lineBreak: false });
    doc.font('Times-Bold').fontSize(11)
      .text('PRINCIPAL', PAGE_RIGHT - 180, footerAreaY, { width: 160, align: 'center', lineBreak: false });

    // Add page numbers at the bottom
    const pages = doc.bufferedPageRange().count;
    doc.fontSize(9).fillColor('#666666').text(`Page 1 of ${pages}`, PAGE_LEFT, 780, { align: 'center', width: PAGE_WIDTH });

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
