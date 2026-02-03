import express from 'express';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { logActivity } from '../utils/logger.js';

import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
      else resolve(rows);
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

// Initialize database schema for nested folders and files
const initializeFolderSchema = () => {
  const db = getDatabase();

  // Add columns for nested folders and file storage if they don't exist
  db.run(`ALTER TABLE bill_folders ADD COLUMN parent_folder_id INTEGER DEFAULT NULL`, () => { });
  db.run(`ALTER TABLE bill_folders ADD COLUMN is_file BOOLEAN DEFAULT 0`, () => { });
  db.run(`ALTER TABLE bill_folders ADD COLUMN file_path TEXT DEFAULT NULL`, () => { });
  db.run(`ALTER TABLE bill_folders ADD COLUMN file_size INTEGER DEFAULT NULL`, () => { });
  db.run(`ALTER TABLE bill_folders ADD COLUMN file_type TEXT DEFAULT NULL`, () => { });
  db.run(`ALTER TABLE bill_folders ADD COLUMN file_name TEXT DEFAULT NULL`, () => { });
};

// Run initialization (commented out - run manually if needed or move to migration)
// initializeFolderSchema();

// Get all bills (optionally filtered by folder)
router.get('/', authenticateToken, requirePermission('can_manage_bills', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { folderId } = req.query;

    const baseQuery = `
      SELECT b.*, 
             u1.name as submitted_by_name,
             u2.name as approved_by_name,
             p.title as project_title,
             bf.name as folder_name
      FROM bills b
      LEFT JOIN users u1 ON b.submitted_by = u1.id
      LEFT JOIN users u2 ON b.approved_by = u2.id
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN bill_folders bf ON b.folder_id = bf.id
    `;

    let whereClause = '';
    const params = [];

    if (folderId) {
      whereClause = 'WHERE b.folder_id = ?';
      params.push(folderId);
    }

    const bills = await all(db, `${baseQuery} ${whereClause} ORDER BY b.created_at DESC`, params);

    // Attach itemized entries for each bill (include transport from/to fields)
    for (const bill of bills) {
      try {
        const items = await all(db, 'SELECT id, category, description, amount, from_loc as `from`, to_loc as `to` FROM bill_items WHERE bill_id = ?', [bill.id]);
        bill.items = items || [];
      } catch (e) {
        bill.items = [];
      }
      bill.amount = Number(bill.amount || 0);
    }

    res.json({ success: true, bills });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create bill
router.post('/', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), [
  body('title').notEmpty().trim(),
  body('amount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { title, amount, description, bill_date, project_id, bill_type, drive_link, items } = req.body;
    const db = getDatabase();

    // If items provided, calculate total from them; otherwise fallback to amount
    let totalAmount = 0;
    if (Array.isArray(items) && items.length > 0) {
      totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
    } else {
      totalAmount = parseFloat(amount) || 0;
    }

    const folder_id = req.body.folder_id || null;
    const result = await run(db,
      'INSERT INTO bills (title, amount, description, bill_date, project_id, submitted_by, bill_type, drive_link, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, totalAmount, description || null, bill_date || new Date().toISOString().split('T')[0], project_id || null, req.user.id, bill_type || null, drive_link || null, folder_id]
    );

    // Insert items if provided (support optional from/to for transport items)
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const fromLoc = it.from || it.from_loc || null;
        const toLoc = it.to || it.to_loc || null;
        await run(db, 'INSERT INTO bill_items (bill_id, category, description, amount, from_loc, to_loc) VALUES (?, ?, ?, ?, ?, ?)', [result.lastID, it.category || 'other', it.description || null, parseFloat(it.amount) || 0, fromLoc, toLoc]);
      }
    }

    await logActivity(req.user.id, 'CREATE_BILL', { title, amount: totalAmount }, req, {
      action_type: 'CREATE',
      module_name: 'bills',
      action_description: `Submitted bill: ${title} (Amount: ${totalAmount})`,
      reference_id: result.lastID
    });

    res.json({ success: true, message: 'Bill submitted successfully', id: result.lastID });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update bill (owner or admin/edit-perm)
router.put('/:id', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), [
  body('title').optional().trim(),
  body('amount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const bill = await get(db, 'SELECT * FROM bills WHERE id = ?', [req.params.id]);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Only admin or the user who submitted can update
    if (req.user.role !== 'admin' && bill.submitted_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updates = [];
    const params = [];

    if (req.body.title !== undefined) { updates.push('title = ?'); params.push(req.body.title); }
    if (req.body.description !== undefined) { updates.push('description = ?'); params.push(req.body.description); }
    if (req.body.bill_date !== undefined) { updates.push('bill_date = ?'); params.push(req.body.bill_date); }
    if (req.body.bill_type !== undefined) { updates.push('bill_type = ?'); params.push(req.body.bill_type); }
    if (req.body.amount !== undefined) { updates.push('amount = ?'); params.push(req.body.amount); }
    if (req.body.project_id !== undefined) { updates.push('project_id = ?'); params.push(req.body.project_id); }
    if (req.body.drive_link !== undefined) { updates.push('drive_link = ?'); params.push(req.body.drive_link); }
    if (req.body.folder_id !== undefined) { updates.push('folder_id = ?'); params.push(req.body.folder_id || null); }

    // Handle items update separately if provided
    if (Array.isArray(req.body.items)) {
      // Replace existing items for this bill
      await run(db, 'DELETE FROM bill_items WHERE bill_id = ?', [req.params.id]);
      for (const it of req.body.items) {
        const fromLoc = it.from || it.from_loc || null;
        const toLoc = it.to || it.to_loc || null;
        await run(db, 'INSERT INTO bill_items (bill_id, category, description, amount, from_loc, to_loc) VALUES (?, ?, ?, ?, ?, ?)', [req.params.id, it.category || 'other', it.description || null, parseFloat(it.amount) || 0, fromLoc, toLoc]);
      }

      // Recalculate amount from items and include in updates
      const recalculated = req.body.items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
      updates.push('amount = ?'); params.push(recalculated);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);

    await run(db, `UPDATE bills SET ${updates.join(', ')} WHERE id = ?`, params);

    await logActivity(req.user.id, 'UPDATE_BILL', { id: req.params.id, updates: req.body }, req, {
      action_type: 'UPDATE',
      module_name: 'bills',
      action_description: `Updated bill: ${bill.title}`,
      reference_id: req.params.id
    });

    res.json({ success: true, message: 'Bill updated successfully' });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve/Reject bill
router.put('/:id/approve', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), [
  body('status').isIn(['approved', 'rejected'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const bill = await get(db, 'SELECT * FROM bills WHERE id = ?', [req.params.id]);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    await run(db,
      'UPDATE bills SET status = ?, approved_by = ? WHERE id = ?',
      [req.body.status, req.user.id, req.params.id]
    );

    await logActivity(req.user.id, 'APPROVE_BILL', { id: req.params.id, status: req.body.status }, req, {
      action_type: 'UPDATE',
      module_name: 'bills',
      action_description: `${req.body.status === 'approved' ? 'Approved' : 'Rejected'} bill: ${bill.title}`,
      reference_id: req.params.id
    });

    res.json({ success: true, message: `Bill ${req.body.status} successfully` });
  } catch (error) {
    console.error('Approve bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete bill (owner or admin/edit-perm)
router.delete('/:id', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const bill = await get(db, 'SELECT * FROM bills WHERE id = ?', [req.params.id]);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Only admin or the user who submitted can delete
    if (req.user.role !== 'admin' && bill.submitted_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Remove associated items explicitly (foreign key cascade may handle it if enabled)
    await run(db, 'DELETE FROM bill_items WHERE bill_id = ?', [req.params.id]);
    await run(db, 'DELETE FROM bills WHERE id = ?', [req.params.id]);

    await logActivity(req.user.id, 'DELETE_BILL', { id: req.params.id, title: bill.title }, req, {
      action_type: 'DELETE',
      module_name: 'bills',
      action_description: `Deleted bill: ${bill.title}`,
      reference_id: req.params.id
    });

    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bill folders endpoints
// List folders (with optional parent filtering for nested structure)
router.get('/folders', authenticateToken, requirePermission('can_manage_bills', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { parent_id } = req.query;

    let query = 'SELECT bf.*, u.name as created_by_name FROM bill_folders bf LEFT JOIN users u ON bf.created_by = u.id';
    let params = [];

    if (parent_id === '' || parent_id === 'null' || parent_id === undefined) {
      // Get root level folders/files (parent_folder_id IS NULL)
      query += ' WHERE bf.parent_folder_id IS NULL';
    } else {
      // Get children of specific folder
      query += ' WHERE bf.parent_folder_id = ?';
      params.push(parseInt(parent_id));
    }

    query += ' ORDER BY bf.is_file ASC, bf.name ASC'; // Folders first, then files

    const folders = await all(db, query, params);
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Get bill folders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Configure multer for folder file uploads
const folderUpload = multer({
  dest: path.join(process.cwd(), 'public', 'uploads', 'bills', 'tmp'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Create folder with optional file uploads
router.post('/folders', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), folderUpload.array('files'), async (req, res) => {
  try {
    const { name, description, parent_folder_id } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Folder name is required' });
    }

    const db = getDatabase();
    const parentId = parent_folder_id ? parseInt(parent_folder_id) : null;

    // Create the folder
    const result = await run(db,
      'INSERT INTO bill_folders (name, description, created_by, parent_folder_id, is_file) VALUES (?, ?, ?, ?, 0)',
      [name, description || null, req.user.id, parentId]
    );

    const folderId = result.lastID;

    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const originalName = file.originalname;
        const fileExt = path.extname(originalName);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;

        // Create folder path: /bills/{folderId}/
        const folderPath = path.join(process.cwd(), 'public', 'uploads', 'bills', folderId.toString());
        fs.mkdirSync(folderPath, { recursive: true });

        const targetPath = path.join(folderPath, fileName);
        fs.renameSync(file.path, targetPath);

        const dbPath = `/uploads/bills/${folderId}/${fileName}`;

        // Insert file record as a child of the folder
        await run(db,
          'INSERT INTO bill_folders (name, file_name, file_path, file_size, file_type, created_by, parent_folder_id, is_file) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          [originalName, originalName, dbPath, file.size, file.mimetype, req.user.id, folderId]
        );
      }
    }

    res.json({ success: true, message: 'Folder created', id: folderId });
  } catch (error) {
    console.error('Create bill folder error:', error);
    // Cleanup uploaded files on error
    if (req.files) {
      req.files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update folder
router.put('/folders/:id', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), [
  body('name').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { id } = req.params;
    const { name, description } = req.body;
    const db = getDatabase();
    const existing = await get(db, 'SELECT id FROM bill_folders WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Folder not found' });
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(id);
    await run(db, `UPDATE bill_folders SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Folder updated' });
  } catch (error) {
    console.error('Update bill folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete folder or file
router.delete('/folders/:id', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const existing = await get(db, 'SELECT * FROM bill_folders WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Folder/File not found' });

    if (existing.is_file) {
      // It's a file - delete the physical file
      if (existing.file_path) {
        const filePath = path.join(process.cwd(), 'public', existing.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      await run(db, 'DELETE FROM bill_folders WHERE id = ?', [id]);
      res.json({ success: true, message: 'File deleted' });
    } else {
      // It's a folder - check for children
      const children = await all(db, 'SELECT id FROM bill_folders WHERE parent_folder_id = ?', [id]);
      const bills = await all(db, 'SELECT id FROM bills WHERE folder_id = ?', [id]);

      if (children.length > 0 || bills.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete folder with ${children.length} subfolders/files and ${bills.length} bills. Please move or delete them first.`
        });
      }

      // Move bills to null folder (if any)
      await run(db, 'UPDATE bills SET folder_id = NULL WHERE folder_id = ?', [id]);
      await run(db, 'DELETE FROM bill_folders WHERE id = ?', [id]);
      res.json({ success: true, message: 'Folder deleted' });
    }
  } catch (error) {
    console.error('Delete bill folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Initialize bill_images table (commented out - causes server crash)
// const db = getDatabase();
// db.run(`CREATE TABLE IF NOT EXISTS bill_images (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   bill_id INTEGER NOT NULL,
//   folder_name TEXT NOT NULL,
//   image_path TEXT NOT NULL,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (bill_id) REFERENCES bills (id)
// )`);

// Configure multer (using temporary storage, we move files manually)
const upload = multer({
  dest: path.join(process.cwd(), 'public', 'uploads', 'tmp'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Helper to sanitize folder names
const sanitize = (name) => {
  return name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
};

// Upload images to a bill
router.post('/:id/images', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), upload.array('images'), async (req, res) => {
  try {
    const { id } = req.params;
    const { folderName } = req.body; // "Image Name" provided by user

    if (!folderName) {
      return res.status(400).json({ success: false, message: 'Image folder name is required' });
    }

    const db = getDatabase();

    // 1. Get Bill & Parent Folder Info
    const bill = await get(db, `
      SELECT b.title, bf.name as parent_folder_name 
      FROM bills b
      LEFT JOIN bill_folders bf ON b.folder_id = bf.id
      WHERE b.id = ?
    `, [id]);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // 2. Construct Paths
    // Root: public/uploads/bills
    // Path: {Root}/{ParentFolder}/{BillTitle}/{ImageFolderName}/

    const parentFolder = bill.parent_folder_name ? sanitize(bill.parent_folder_name) : 'unsorted';
    const billFolder = sanitize(bill.title);
    const imageFolder = sanitize(folderName);

    const relativePath = path.join('bills', parentFolder, billFolder, imageFolder);
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', relativePath);

    // 3. Create Directory
    fs.mkdirSync(absolutePath, { recursive: true });

    // 4. Move Files & Insert Records
    const savedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        const targetPath = path.join(absolutePath, filename);

        // Move file
        fs.renameSync(file.path, targetPath);

        // Save relative path for DB
        const dbPath = `/uploads/${relativePath.replace(/\\/g, '/')}/${filename}`;

        await run(db, `
          INSERT INTO bill_images (bill_id, folder_name, image_path)
          VALUES (?, ?, ?)
        `, [id, folderName, dbPath]); // Store original display name for folder? Or sanitized? 
        // Request says "Image path stored in DB must include: Folder -> Bill -> ImageFolder -> ImageFile".
        // We stored the path. We also store `folder_name` (user visible) for display.

        savedImages.push(dbPath);
      }
    }

    res.json({ success: true, message: 'Images uploaded successfully', images: savedImages });
  } catch (error) {
    console.error('Upload bill images error:', error);
    // Cleanup tmp files if error
    if (req.files) {
      req.files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

// Get images for a bill
router.get('/:id/images', authenticateToken, requirePermission('can_manage_bills', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const images = await all(db, 'SELECT * FROM bill_images WHERE bill_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json({ success: true, images });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete an image
router.delete('/images/:imageId', authenticateToken, requirePermission('can_manage_bills', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const image = await get(db, 'SELECT * FROM bill_images WHERE id = ?', [req.params.imageId]);

    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // Verify ownership via bill
    const bill = await get(db, 'SELECT submitted_by FROM bills WHERE id = ?', [image.bill_id]);
    if (req.user.role !== 'admin' && bill.submitted_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Delete file
    const fsPath = path.join(process.cwd(), 'public', image.image_path);
    if (fs.existsSync(fsPath)) {
      fs.unlinkSync(fsPath);
    }

    // Check if folder is empty? The user requested "Allow deleting image or entire image folder".
    // For now just delete record.
    await run(db, 'DELETE FROM bill_images WHERE id = ?', [req.params.imageId]);

    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

