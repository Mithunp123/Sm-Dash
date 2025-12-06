import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'resources');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `resource-${unique}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn(`File rejected: ${file.originalname} with mimetype ${file.mimetype}`);
    cb(new Error(`File type not allowed. Supported: PDF, Word, PowerPoint, Excel, Text, Images`));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

const all = (db, query, params = []) => new Promise((resolve, reject) => db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows)));
const run = (db, query, params = []) => new Promise((resolve, reject) => db.run(query, params, function(err) { if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes }); }));
const get = (db, query, params = []) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));

const resolvePublicBaseUrl = (req) => {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.PUBLIC_UPLOAD_BASE_URL || process.env.API_BASE_URL;
  if (envUrl && typeof envUrl === 'string') {
    const trimmed = envUrl.replace(/\/$/, '');
    return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  const host = req.get('host');
  return `${proto}://${host}`;
};

// List resource folders
router.get('/folders', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const folders = await all(db, 'SELECT id, name, description, parent_id, created_by, created_at FROM resource_folders ORDER BY name');
    res.json({ success: true, folders });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create folder
router.post('/folders', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const { name, description, parent_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Folder name is required' });
    }
    const result = await run(db, 
      'INSERT INTO resource_folders (name, description, parent_id, created_by) VALUES (?, ?, ?, ?)',
      [name.trim(), description || null, parent_id || null, req.user.id]
    );
    const folder = await get(db, 'SELECT * FROM resource_folders WHERE id = ?', [result.lastID]);
    res.json({ success: true, folder });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete folder
router.delete('/folders/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    // Check if folder has resources
    const resources = await all(db, 'SELECT id FROM resources WHERE folder_id = ?', [id]);
    if (resources.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete folder with resources. Move or delete resources first.' });
    }
    await run(db, 'DELETE FROM resource_folders WHERE id = ?', [id]);
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// List resources - authenticated users may view
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    // allow optional filtering by category, folder, resource_type, year, month via query param
    const catFilter = req.query.category ? String(req.query.category) : null;
    const folderFilter = req.query.folder_id ? parseInt(req.query.folder_id) : null;
    const showRootOnly = req.query.folder_id === 'null' || req.query.folder_id === '';
    const resourceTypeFilter = req.query.resource_type ? String(req.query.resource_type) : null;
    const excludeResourceType = req.query.exclude_resource_type ? String(req.query.exclude_resource_type) : null;
    const yearFilter = req.query.year ? String(req.query.year) : null;
    const monthFilter = req.query.month ? String(req.query.month) : null;
    
    let baseQuery = 'SELECT id, filename, original_name, mime_type, path, title, resource_type, category, folder_id, uploaded_by, created_at, description, upload_date, upload_time FROM resources';
    const conditions = [];
    const params = [];
    
    if (catFilter) {
      conditions.push('category = ?');
      params.push(catFilter);
    }
    if (resourceTypeFilter) {
      conditions.push('resource_type = ?');
      params.push(resourceTypeFilter);
    }
    if (excludeResourceType) {
      conditions.push('(resource_type IS NULL OR resource_type != ?)');
      params.push(excludeResourceType);
    }
    if (yearFilter) {
      conditions.push("strftime('%Y', COALESCE(upload_date, created_at)) = ?");
      params.push(yearFilter);
    }
    if (monthFilter) {
      conditions.push("strftime('%m', COALESCE(upload_date, created_at)) = ?");
      params.push(monthFilter.padStart(2, '0'));
    }
    if (showRootOnly) {
      conditions.push('(folder_id IS NULL OR folder_id = 0)');
    } else if (folderFilter !== null && !isNaN(folderFilter)) {
      conditions.push('folder_id = ?');
      params.push(folderFilter);
    }
    
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }
    baseQuery += ' ORDER BY COALESCE(upload_date, created_at) DESC, COALESCE(upload_time, "00:00:00") DESC';
    
    const rows = await all(db, baseQuery, params);

    const publicBase = resolvePublicBaseUrl(req);

    // Build public URL for each resource
    const resources = rows.map((r) => ({
      ...r,
      url: `${publicBase}/uploads/resources/${r.filename}`
    }));
    res.json({ success: true, resources });
  } catch (error) {
    console.error('List resources error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upload resource - admin only
router.post('/', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    // Debug logging to help diagnose upload issues
    console.log('Resources upload request by user:', req.user ? { id: req.user.id, role: req.user.role, email: req.user.email } : 'no-user');
    console.log('Request headers:', Object.keys(req.headers).reduce((acc, k) => ({ ...acc, [k]: req.headers[k] }), {}));

    if (!req.file) {
      console.warn('No file found on req.file after multer middleware');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Validate required title (display name)
    if (!req.body || !req.body.title || String(req.body.title).trim() === '') {
      // delete uploaded file if present
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file after missing title:', err); });
      }
      return res.status(400).json({ success: false, message: 'Title (display name) is required' });
    }

    const db = getDatabase();
    const { filename, originalname, mimetype, size } = req.file;
    const title = (req.body && req.body.title && String(req.body.title).trim() !== '') ? req.body.title : originalname;
    const resourceType = (req.body && req.body.resource_type) ? String(req.body.resource_type).trim() : 'CONTENT TEAM';
    const category = (req.body && req.body.category) ? String(req.body.category).trim() : 'CONTENT TEAM';
    
    // Handle upload date and time
    let uploadDate = null;
    let uploadTime = null;
    if (req.body.upload_date) {
      uploadDate = req.body.upload_date;
    } else {
      const now = new Date();
      uploadDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    if (req.body.upload_time) {
      uploadTime = req.body.upload_time;
    } else {
      const now = new Date();
      uploadTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    }
    
    console.log('Uploaded file info:', { filename, originalname, mimetype, size, title, resourceType, category, uploadDate, uploadTime });

    const filePath = `/uploads/resources/${filename}`;
    const folderId = req.body.folder_id ? parseInt(req.body.folder_id) : null;

    const result = await run(db, 'INSERT INTO resources (filename, original_name, mime_type, path, title, resource_type, category, folder_id, uploaded_by, upload_date, upload_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [filename, originalname, mimetype, filePath, title, resourceType, category, folderId, req.user.id, uploadDate, uploadTime]);

    // Read back the inserted row to include created_at, upload_date, upload_time
  const saved = await get(db, 'SELECT id, filename, original_name, mime_type, path, title, resource_type, category, folder_id, uploaded_by, created_at, upload_date, upload_time FROM resources WHERE id = ?', [result.lastID]);

    res.json({ success: true, resource: saved });
  } catch (error) {
    console.error('Upload resource error:', error);
    // Delete file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file after failure:', err); });
    }
    if (error.name === 'MulterError' || error.message?.toLowerCase()?.includes('pdf') || error.message?.toLowerCase()?.includes('word')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a resource - admin only
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, description, resource_type, category } = req.body;

    const existing = await get(db, 'SELECT id FROM resources WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (resource_type !== undefined) {
      updates.push('resource_type = ?');
      params.push(resource_type);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(id);
    await run(db, `UPDATE resources SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await get(db, 'SELECT id, filename, original_name, mime_type, path, title, resource_type, category, folder_id, uploaded_by, created_at, description FROM resources WHERE id = ?', [id]);
    res.json({ success: true, resource: updated, message: 'Resource updated successfully' });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a resource - admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const id = req.params.id;
    const row = await get(db, 'SELECT id, filename, path FROM resources WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, message: 'Resource not found' });

    // Remove file from disk if exists
    const fileOnDisk = path.join(uploadDir, row.filename);
    try {
      if (fs.existsSync(fileOnDisk)) fs.unlinkSync(fileOnDisk);
    } catch (fsErr) {
      console.error('Failed to delete file from disk:', fsErr);
      // continue to delete DB entry even if file removal failed
    }

    await run(db, 'DELETE FROM resources WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Resource deleted' });
  } catch (err) {
    console.error('Delete resource error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Router-level error handler (handles multer errors and other sync errors)
router.use((err, req, res, next) => {
  if (!err) return next();
  console.error('Resources router error:', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.message && (err.message.toLowerCase().includes('pdf') || err.message.toLowerCase().includes('word'))) {
    return res.status(400).json({ success: false, message: err.message });
  }
  return res.status(500).json({ success: false, message: err.message || 'Server error' });
});

// Dev-only test upload endpoint (no auth) to quickly verify multer and disk write behavior.
// This endpoint is only registered when NODE_ENV !== 'production'. Remove or secure it after debugging.
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', upload.single('file'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      console.log('Dev test upload saved:', req.file.path);
      return res.json({ success: true, file: { filename: req.file.filename, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, path: `/uploads/resources/${req.file.filename}` } });
    } catch (err) {
      console.error('Dev test upload error:', err);
      return res.status(500).json({ success: false, message: (err && err.message) || 'Server error' });
    }
  });
}

// NOTE: The rebuild endpoint was intentionally removed to prevent destructive operations from the API.

export default router;
